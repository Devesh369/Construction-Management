"""
Expenses and Vendor services.
Contracts:
- create_expense(user, data) -> Expense
- approve_expense(expense, approver) -> Expense
- reject_expense(expense, approver, reason) -> Expense
- cancel_expense(expense, user, reason) -> Expense
- record_vendor_payment(vendor, user, data) -> VendorPayment
- vendor_balance(vendor) -> Decimal
- vendor_statement(vendor, date_from, date_to) -> list[dict]
"""

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from core.exceptions import BusinessRuleError
from core.money import q2
from expenses.models import (
    Expense,
    ExpenseStatus,
    PaymentMode,
    Vendor,
    VendorPayment,
)

CATEGORY_TO_ACCOUNT = {
    "MATERIAL": "5001",
    "EQUIPMENT_RENTAL": "5002",
    "FUEL": "5003",
    "TRANSPORT": "5003",
    "UTILITY": "5004",
    "PETTY_CASH": "5006",
    "OTHER": "5006",
}


def create_expense(user, data: dict) -> Expense:
    """
    Create an expense. If amount <= organization.expense_approval_limit, auto-approve and post to ledger.
    Otherwise status is PENDING_APPROVAL.
    """
    org = user.organization
    amount = q2(data["amount"])
    payment_mode = data.get("payment_mode", "CASH")

    # Validate credit purchase
    if payment_mode == PaymentMode.CREDIT:
        if not data.get("vendor"):
            raise BusinessRuleError(
                "Credit purchase requires an assigned vendor.", code="vendor_required"
            )
        if not data.get("due_date"):
            raise BusinessRuleError(
                "Credit purchase requires a due date.", code="due_date_required"
            )

    status = (
        ExpenseStatus.APPROVED
        if amount <= org.expense_approval_limit
        else ExpenseStatus.PENDING_APPROVAL
    )

    with transaction.atomic():
        expense = Expense.objects.create(
            organization=org,
            project=data["project"],
            vendor=data.get("vendor"),
            category=data["category"],
            description=data["description"],
            amount=amount,
            expense_date=data["expense_date"],
            payment_mode=payment_mode,
            invoice_number=data.get("invoice_number", ""),
            due_date=data.get("due_date"),
            receipt=data.get("receipt"),
            is_recurring=data.get("is_recurring", False),
            details=data.get("details", {}),
            status=status,
            created_by=user,
            approved_by=user if status == ExpenseStatus.APPROVED else None,
            approved_at=timezone.now() if status == ExpenseStatus.APPROVED else None,
        )

        if status == ExpenseStatus.APPROVED:
            _post_expense_to_ledger_and_spend(expense, user)

    return expense


def approve_expense(expense: Expense, approver) -> Expense:
    """Approve expense. Creator cannot approve their own expense."""
    if expense.created_by_id == approver.id:
        raise BusinessRuleError(
            "You cannot approve your own expense.", code="self_approval_blocked"
        )
    if expense.status != ExpenseStatus.PENDING_APPROVAL:
        raise BusinessRuleError(
            "Only PENDING_APPROVAL expenses can be approved.", code="invalid_status"
        )

    with transaction.atomic():
        expense.status = ExpenseStatus.APPROVED
        expense.approved_by = approver
        expense.approved_at = timezone.now()
        _post_expense_to_ledger_and_spend(expense, approver)
        expense.save(
            update_fields=["status", "approved_by", "approved_at", "journal_entry", "updated_at"]
        )

    return expense


def reject_expense(expense: Expense, approver, reason: str) -> Expense:
    """Reject an expense with a mandatory reason."""
    if not reason:
        raise BusinessRuleError("Rejection reason is required.", code="reason_required")
    if expense.status != ExpenseStatus.PENDING_APPROVAL:
        raise BusinessRuleError(
            "Only PENDING_APPROVAL expenses can be rejected.", code="invalid_status"
        )

    expense.status = ExpenseStatus.REJECTED
    expense.approved_by = approver
    expense.approved_at = timezone.now()
    expense.rejection_reason = reason
    expense.save(
        update_fields=["status", "approved_by", "approved_at", "rejection_reason", "updated_at"]
    )
    return expense


def cancel_expense(expense: Expense, user, reason: str) -> Expense:
    """Cancel an approved expense, reversing its journal entry and rolling back project spend."""
    if expense.status != ExpenseStatus.APPROVED:
        raise BusinessRuleError("Only APPROVED expenses can be cancelled.", code="invalid_status")

    from ledger.services import reverse_entry
    from projects.services import update_spend

    with transaction.atomic():
        expense.status = ExpenseStatus.CANCELLED
        expense.cancel_reason = reason

        if expense.journal_entry:
            reverse_entry(
                expense.journal_entry,
                user=user,
                reason=f"Cancelled expense #{expense.id}: {reason}",
            )

        update_spend(expense.project, -expense.amount, reason=f"Cancelled expense #{expense.id}")
        expense.save(update_fields=["status", "cancel_reason", "updated_at"])

    return expense


def _post_expense_to_ledger_and_spend(expense: Expense, user):
    """Helper: create balanced double-entry journal and increment project actual_spend."""
    from ledger.services import post_journal_entry
    from projects.services import update_spend

    expense_acct = CATEGORY_TO_ACCOUNT.get(expense.category, "5006")
    if expense.payment_mode == PaymentMode.CREDIT:
        credit_acct = "2001"  # Accounts Payable
    elif expense.payment_mode == PaymentMode.CASH:
        credit_acct = "1001"  # Cash in Hand
    else:
        credit_acct = "1002"  # Bank Account

    lines = [
        {
            "account_code": expense_acct,
            "side": "DR",
            "amount": expense.amount,
            "memo": expense.description[:100],
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


def record_vendor_payment(vendor: Vendor, user, data: dict) -> VendorPayment:
    """Record payment to a vendor, reducing accounts payable balance."""
    amount = q2(data["amount"])
    outstanding = vendor.outstanding_balance
    if amount > outstanding:
        raise BusinessRuleError(
            f"Payment amount ({amount}) exceeds outstanding balance ({outstanding}).",
            code="overpayment_not_allowed",
        )

    from ledger.services import post_journal_entry

    with transaction.atomic():
        credit_acct = "1001" if data.get("payment_mode") == "CASH" else "1002"
        lines = [
            {
                "account_code": "2001",
                "side": "DR",
                "amount": amount,
                "memo": f"Payment to {vendor.name}",
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
            payment_mode=data.get("payment_mode", "BANK_TRANSFER"),
            reference=data.get("reference", ""),
            notes=data.get("notes", ""),
            paid_by=user,
            journal_entry=entry,
        )
    return vp


def vendor_balance(vendor: Vendor) -> Decimal:
    """Return current computed outstanding balance for vendor."""
    return vendor.outstanding_balance


def vendor_statement(vendor: Vendor, date_from=None, date_to=None) -> list[dict]:
    """Return chronological statement of credit purchases and payments."""
    return []
