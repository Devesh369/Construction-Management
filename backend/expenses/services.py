"""
Expenses, Vendors, Payments, and Running Cost Baseline services.
Single source of truth for UC-18 through UC-22.
"""

from datetime import date
from decimal import Decimal

from audit.constants import AuditAction
from audit.services import log_action
from core.exceptions import BusinessRuleError
from core.money import q2
from core.roles import Role
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from ledger.services import post_journal_entry, reverse_entry
from projects.models import Project
from projects.services import update_spend

from expenses.models import (
    Expense,
    ExpenseCategory,
    ExpenseStatus,
    PaymentMode,
    RunningCostBaseline,
    UtilityType,
    Vendor,
    VendorPayment,
)

# Category to expense account mapping as defined in Master Brief Section 7.2
CATEGORY_TO_ACCOUNT = {
    ExpenseCategory.MATERIAL: "5001",
    ExpenseCategory.EQUIPMENT_RENTAL: "5002",
    ExpenseCategory.EQUIPMENT: "5002",
    ExpenseCategory.FUEL: "5003",
    ExpenseCategory.TRANSPORT: "5003",
    ExpenseCategory.UTILITY: "5004",
    ExpenseCategory.LABOR: "5006",
    ExpenseCategory.PETTY_CASH: "5006",
    ExpenseCategory.OTHER: "5006",
}


def create_expense(user, data: dict, request=None) -> Expense:
    """
    UC-18, UC-19, UC-21: Create an expense.
    - If amount <= organization.expense_approval_limit: auto-approved and posted to ledger immediately.
    - If amount > organization.expense_approval_limit: PENDING_APPROVAL and receipt is required.
    - If payment_mode is CREDIT: requires vendor and due_date.
    - If user is SUPERVISOR: category must be TRANSPORT.
    - Validates category-specific details and flags baseline spike warnings.
    """
    org = user.organization
    amount = q2(data["amount"])
    payment_mode = data.get("payment_mode", PaymentMode.CASH)
    category = data["category"]
    details = dict(data.get("details") or {})

    # 1. Supervisor role restriction: only TRANSPORT
    user_role = getattr(user, "role", None)
    if user_role == Role.SUPERVISOR and category != ExpenseCategory.TRANSPORT:
        raise BusinessRuleError(
            "Supervisors are only permitted to log transport expenses.",
            code="supervisor_category_restricted",
        )

    # 2. Receipt requirement: required if amount > organization.expense_approval_limit
    has_receipt = bool(data.get("receipt"))
    if amount > org.expense_approval_limit and not has_receipt:
        raise BusinessRuleError(
            "Receipt is required when amount exceeds the approval limit.",
            code="receipt_required",
        )

    # 3. Credit purchase validation (UC-19)
    if payment_mode == PaymentMode.CREDIT:
        if not data.get("vendor"):
            raise BusinessRuleError(
                "Credit purchase requires an assigned vendor.",
                code="vendor_required",
            )
        if not data.get("due_date"):
            raise BusinessRuleError(
                "Credit purchase requires a due date.",
                code="due_date_required",
            )

    # 4. Category-specific details validation (UC-21)
    project = data["project"]
    if category == ExpenseCategory.UTILITY:
        u_type = details.get("utility_type")
        if not u_type or u_type not in UtilityType.values:
            raise BusinessRuleError(
                "Utility expense requires a valid utility_type in details.",
                code="utility_type_required",
            )
        if not details.get("billing_month"):
            raise BusinessRuleError(
                "Utility expense requires billing_month in details.",
                code="billing_month_required",
            )

        # Baseline spike warning (does not block)
        baseline = RunningCostBaseline.objects.filter(project=project, utility_type=u_type).first()
        if baseline and amount > q2(baseline.monthly_baseline * Decimal("1.25")):
            details["spike_warning"] = True
        else:
            details["spike_warning"] = False

    elif category == ExpenseCategory.TRANSPORT:
        if not details.get("vehicle_number"):
            raise BusinessRuleError(
                "Transport expense requires vehicle_number in details.",
                code="vehicle_number_required",
            )
        dist = details.get("distance_km")
        if dist is None:
            raise BusinessRuleError(
                "Transport expense requires distance_km in details.",
                code="distance_km_required",
            )
        try:
            dist_val = Decimal(str(dist))
            if dist_val < Decimal("0"):
                raise ValueError
        except Exception:
            raise BusinessRuleError(
                "Transport expense requires distance_km >= 0 in details.",
                code="distance_km_invalid",
            )

        if details.get("is_machinery_transfer") and not details.get("destination_project_id"):
            raise BusinessRuleError(
                "Machinery transfer requires destination_project_id in details.",
                code="destination_project_required",
            )

    # 5. Determine initial status based on approval limit
    is_auto_approved = amount <= org.expense_approval_limit
    status_val = ExpenseStatus.APPROVED if is_auto_approved else ExpenseStatus.PENDING_APPROVAL

    with transaction.atomic():
        expense = Expense.objects.create(
            organization=org,
            project=project,
            vendor=data.get("vendor"),
            category=category,
            description=data["description"],
            amount=amount,
            expense_date=data["expense_date"],
            payment_mode=payment_mode,
            invoice_number=data.get("invoice_number", ""),
            due_date=data.get("due_date"),
            receipt=data.get("receipt"),
            is_recurring=data.get("is_recurring", False),
            details=details,
            status=status_val,
            created_by=user,
            approved_by=user if is_auto_approved else None,
            approved_at=timezone.now() if is_auto_approved else None,
        )

        if is_auto_approved:
            _post_expense_to_ledger_and_spend(expense, user)
            log_action(
                user=user,
                action=AuditAction.EXPENSE_APPROVED,
                obj=expense,
                changes={
                    "status": ExpenseStatus.APPROVED,
                    "auto_approved": True,
                    "amount": str(expense.amount),
                },
                request=request,
            )

    try:
        from ledger.services_transactions import TransactionService

        TransactionService.sync_organization_transactions(org)
    except Exception:
        pass

    return expense


def approve_expense(expense: Expense, approver, request=None) -> Expense:
    """
    UC-20: PM / ORG_ADMIN approves an expense.
    - Creator cannot approve their own expense.
    - Posts balanced double-entry journal to ledger.
    - Updates project spend.
    - Logs audit trail.
    """
    if expense.created_by_id == approver.id:
        raise BusinessRuleError(
            "You cannot approve your own expense.",
            code="self_approval_blocked",
        )
    if expense.status != ExpenseStatus.PENDING_APPROVAL:
        raise BusinessRuleError(
            "Only PENDING_APPROVAL expenses can be approved.",
            code="invalid_status",
        )

    with transaction.atomic():
        expense.status = ExpenseStatus.APPROVED
        expense.approved_by = approver
        expense.approved_at = timezone.now()
        _post_expense_to_ledger_and_spend(expense, approver)
        expense.save(
            update_fields=["status", "approved_by", "approved_at", "journal_entry", "updated_at"]
        )

        log_action(
            user=approver,
            action=AuditAction.EXPENSE_APPROVED,
            obj=expense,
            changes={"status": ExpenseStatus.APPROVED, "amount": str(expense.amount)},
            request=request,
            organization=expense.organization,
        )

    try:
        from ledger.services_transactions import TransactionService

        TransactionService.sync_organization_transactions(expense.organization)
    except Exception:
        pass

    return expense


def reject_expense(expense: Expense, approver, reason: str, request=None) -> Expense:
    """
    UC-20: PM / ORG_ADMIN rejects an expense.
    - Reason is mandatory.
    - Rejected expenses do not post or change spend.
    """
    if not reason or not reason.strip():
        raise BusinessRuleError("Rejection reason is required.", code="reason_required")
    if expense.status != ExpenseStatus.PENDING_APPROVAL:
        raise BusinessRuleError(
            "Only PENDING_APPROVAL expenses can be rejected.",
            code="invalid_status",
        )

    expense.status = ExpenseStatus.REJECTED
    expense.approved_by = approver
    expense.approved_at = timezone.now()
    expense.rejection_reason = reason.strip()
    expense.save(
        update_fields=["status", "approved_by", "approved_at", "rejection_reason", "updated_at"]
    )

    log_action(
        user=approver,
        action=AuditAction.EXPENSE_REJECTED,
        obj=expense,
        changes={"status": ExpenseStatus.REJECTED, "reason": expense.rejection_reason},
        request=request,
        organization=expense.organization,
    )

    try:
        from ledger.services_transactions import TransactionService

        TransactionService.sync_organization_transactions(expense.organization)
    except Exception:
        pass

    return expense


def cancel_expense(expense: Expense, user, reason: str, request=None) -> Expense:
    """
    UC-20: PM / ORG_ADMIN cancels an approved expense.
    - Reverses journal entry.
    - Reverses project spend: update_spend(project, -amount).
    - Status set to CANCELLED.
    """
    if not reason or not reason.strip():
        raise BusinessRuleError("Cancellation reason is required.", code="reason_required")
    if expense.status != ExpenseStatus.APPROVED:
        raise BusinessRuleError(
            "Only APPROVED expenses can be cancelled.",
            code="invalid_status",
        )

    with transaction.atomic():
        expense.status = ExpenseStatus.CANCELLED
        expense.cancel_reason = reason.strip()

        if expense.journal_entry:
            reverse_entry(
                expense.journal_entry,
                user=user,
                reason=f"Cancelled expense #{expense.id}: {expense.cancel_reason}",
            )

        update_spend(
            expense.project,
            -expense.amount,
            reason=f"Cancelled expense #{expense.id}",
        )
        expense.save(update_fields=["status", "cancel_reason", "updated_at"])

        log_action(
            user=user,
            action=AuditAction.EXPENSE_CANCELLED,
            obj=expense,
            changes={"status": ExpenseStatus.CANCELLED, "reason": expense.cancel_reason},
            request=request,
            organization=expense.organization,
        )

    try:
        from ledger.services_transactions import TransactionService

        TransactionService.sync_organization_transactions(expense.organization)
    except Exception:
        pass

    return expense


def _post_expense_to_ledger_and_spend(expense: Expense, user):
    """
    Helper: create balanced double-entry journal and increment project actual_spend.
    Debit category expense account;
    Credit Cash (1001), Bank (1002), or Accounts Payable (2001) depending on payment mode.
    """
    expense_acct = CATEGORY_TO_ACCOUNT.get(expense.category, "5006")
    if expense.payment_mode == PaymentMode.CREDIT:
        credit_acct = "2001"  # Accounts Payable
    elif expense.payment_mode == PaymentMode.CASH:
        credit_acct = "1001"  # Cash in Hand
    else:
        credit_acct = "1002"  # Bank Account (UPI / BANK_TRANSFER)

    lines = [
        {
            "account_code": expense_acct,
            "side": "DR",
            "amount": expense.amount,
            "memo": f"{expense.category} expense: {expense.description[:80]}",
        },
        {
            "account_code": credit_acct,
            "side": "CR",
            "amount": expense.amount,
            "memo": f"Payment via {expense.payment_mode}",
        },
    ]

    entry = post_journal_entry(
        org=expense.organization,
        date=expense.expense_date,
        description=f"Expense #{expense.id} [{expense.category}]: {expense.description[:50]}",
        lines=lines,
        reference_type="EXPENSE",
        reference_id=expense.id,
        user=user,
        project=expense.project,
    )
    expense.journal_entry = entry
    update_spend(expense.project, expense.amount, reason=f"Expense #{expense.id}")


def record_vendor_payment(vendor: Vendor, user, data: dict, request=None) -> VendorPayment:
    """
    UC-22: Record vendor repayment up to outstanding balance.
    Debit 2001 Accounts Payable, Credit 1001 Cash or 1002 Bank.
    Overpayment is strictly rejected.
    """
    amount = q2(data["amount"])
    if amount <= Decimal("0.00"):
        raise BusinessRuleError("Payment amount must be greater than zero.", code="invalid_amount")

    outstanding = vendor.outstanding_balance
    if amount > outstanding:
        raise BusinessRuleError(
            f"Payment amount ({amount}) exceeds outstanding balance ({outstanding}).",
            code="overpayment_not_allowed",
        )

    credit_acct = "1001" if data.get("payment_mode") == PaymentMode.CASH else "1002"
    with transaction.atomic():
        lines = [
            {
                "account_code": "2001",
                "side": "DR",
                "amount": amount,
                "memo": f"Repayment to {vendor.name}",
            },
            {
                "account_code": credit_acct,
                "side": "CR",
                "amount": amount,
                "memo": f"Vendor payment via {data.get('payment_mode')}",
            },
        ]
        entry = post_journal_entry(
            org=vendor.organization,
            date=data.get("payment_date", timezone.now().date()),
            description=f"Vendor Repayment to {vendor.name}",
            lines=lines,
            reference_type="VENDOR_PAYMENT",
            reference_id=vendor.id,
            user=user,
            project=data.get("project"),
        )
        vp = VendorPayment.objects.create(
            organization=vendor.organization,
            vendor=vendor,
            project=data.get("project"),
            amount=amount,
            payment_date=data.get("payment_date", timezone.now().date()),
            payment_mode=data.get("payment_mode", PaymentMode.BANK_TRANSFER),
            reference=data.get("reference", ""),
            notes=data.get("notes", ""),
            paid_by=user,
            journal_entry=entry,
        )

        log_action(
            user=user,
            action=AuditAction.VENDOR_PAYMENT_RECORDED,
            obj=vp,
            changes={"amount": str(amount), "vendor_id": vendor.id},
            request=request,
            organization=vendor.organization,
        )

    try:
        from ledger.services_transactions import TransactionService

        TransactionService.sync_organization_transactions(vendor.organization)
    except Exception:
        pass

    return vp


def vendor_balance(vendor: Vendor) -> Decimal:
    """Return current computed outstanding balance for vendor."""
    return vendor.outstanding_balance


def vendor_statement(
    vendor: Vendor, date_from: date | None = None, date_to: date | None = None
) -> dict:
    """
    UC-22: Chronological statement of credit purchases and payments with running balance.
    """
    # 1. Opening balance before date_from
    opening_credit = Decimal("0.00")
    opening_pmt = Decimal("0.00")
    if date_from:
        opening_credit = vendor.expenses.filter(
            status=ExpenseStatus.APPROVED,
            payment_mode=PaymentMode.CREDIT,
            expense_date__lt=date_from,
            deleted_at__isnull=True,
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        opening_pmt = vendor.payments.filter(
            payment_date__lt=date_from,
            deleted_at__isnull=True,
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    opening_balance = q2(opening_credit - opening_pmt)
    running_balance = opening_balance

    # 2. In-range queries
    expense_qs = vendor.expenses.filter(
        status=ExpenseStatus.APPROVED,
        payment_mode=PaymentMode.CREDIT,
        deleted_at__isnull=True,
    )
    pmt_qs = vendor.payments.filter(deleted_at__isnull=True)

    if date_from:
        expense_qs = expense_qs.filter(expense_date__gte=date_from)
        pmt_qs = pmt_qs.filter(payment_date__gte=date_from)
    if date_to:
        expense_qs = expense_qs.filter(expense_date__lte=date_to)
        pmt_qs = pmt_qs.filter(payment_date__lte=date_to)

    raw_items = []
    for exp in expense_qs:
        raw_items.append(
            {
                "date": exp.expense_date,
                "created_at": exp.created_at,
                "type": "CREDIT_PURCHASE",
                "reference": exp.invoice_number or f"EXP-{exp.id}",
                "description": exp.description,
                "debit": q2(exp.amount),
                "credit": Decimal("0.00"),
                "project_code": exp.project.code if exp.project else "",
            }
        )
    for pmt in pmt_qs:
        raw_items.append(
            {
                "date": pmt.payment_date,
                "created_at": pmt.created_at,
                "type": "PAYMENT",
                "reference": pmt.reference or f"PMT-{pmt.id}",
                "description": pmt.notes or f"Payment via {pmt.payment_mode}",
                "debit": Decimal("0.00"),
                "credit": q2(pmt.amount),
                "project_code": pmt.project.code if pmt.project else "",
            }
        )

    # Chronological sort
    raw_items.sort(key=lambda x: (x["date"], x["created_at"]))

    entries = []
    for item in raw_items:
        running_balance = q2(running_balance + item["debit"] - item["credit"])
        clean_item = dict(item)
        clean_item.pop("created_at", None)
        entries.append(
            {
                "date": str(clean_item["date"]),
                "type": clean_item["type"],
                "reference": clean_item["reference"],
                "description": clean_item["description"],
                "debit": str(clean_item["debit"]),
                "credit": str(clean_item["credit"]),
                "running_balance": str(running_balance),
                "project_code": clean_item["project_code"],
            }
        )

    return {
        "vendor_id": vendor.id,
        "vendor_name": vendor.name,
        "opening_balance": str(opening_balance),
        "closing_balance": str(running_balance),
        "entries": entries,
    }


def upsert_running_cost_baseline(
    org,
    project: Project,
    utility_type: str,
    monthly_baseline: Decimal,
) -> RunningCostBaseline:
    """
    Upsert monthly baseline for a project and utility type.
    """
    baseline, _ = RunningCostBaseline.objects.update_or_create(
        organization=org,
        project=project,
        utility_type=utility_type,
        defaults={"monthly_baseline": q2(monthly_baseline)},
    )
    return baseline
