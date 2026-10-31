"""
Payment Central Service: Central Unified Transaction Ledger.
Directly implements Section 2 of Module Architecture & Workflow Specification.
"""

import logging
import random
import time
from decimal import Decimal

from attendance.services_settlement import AttendanceSettlementService
from core.exceptions import BusinessRuleError
from django.db import transaction
from django.utils import timezone
from workforce.models import Employee

from ledger.models import (
    Transaction,
    TransactionCategory,
    TransactionMethod,
    TransactionStatus,
    TransactionType,
)

logger = logging.getLogger(__name__)


class TransactionService:
    @staticmethod
    def generate_transaction_id() -> str:
        """Auto-generated unique: TXN-{timestamp}-{random} (Section 2.2)."""
        ts = int(time.time() * 1000)
        rand = random.randint(1000, 9999)
        return f"TXN-{ts}-{rand}"

    @staticmethod
    @transaction.atomic
    def create_transaction(data: dict, user, organization) -> Transaction:
        """
        Step-by-step transaction creation (Section 2.4 A):
        1. Form inputs: type, category, payee/payer, amount, method, metadata.
        2. Unique transactionId generated.
        3. If type=outgoing AND method=cash: CreditLogsService.deductCredit() called.
        4. If type=outgoing, category=salary, and not linked: employee attendance settled.
        """
        amount = Decimal(str(data.get("amount", "0.00")))
        if amount < Decimal("0.00"):
            raise BusinessRuleError("Transaction amount cannot be negative.", code="invalid_amount")

        txn_id = TransactionService.generate_transaction_id()
        txn_type = data.get("type", TransactionType.OUTGOING)
        method = data.get("method", TransactionMethod.CASH)
        category = data.get("category", TransactionCategory.OTHER)
        metadata = data.get("metadata", {}) or {}

        date = data.get("date") or timezone.now().date()
        description = data.get("description", "")

        # 4. Outgoing transaction recording (Cash Credits module removed)
        # 5. Create Transaction document
        txn = Transaction.objects.create(
            organization=organization,
            transaction_id=txn_id,
            date=date,
            type=txn_type,
            category=category,
            payer_name=data.get("payer_name") or organization.name,
            payee_name=data.get("payee_name", ""),
            amount=amount,
            method=method,
            status=data.get("status", TransactionStatus.COMPLETED),
            description=description,
            recorded_by=user,
            metadata=metadata,
        )

        # 6. If outgoing, salary, and not linked to an existing payment: settle attendance
        if (
            txn_type == TransactionType.OUTGOING
            and category == TransactionCategory.SALARY
            and not metadata.get("paymentId")
        ):
            # Resolve employee by payee_name or metadata
            emp_id = metadata.get("employeeId")
            emp = None
            if emp_id:
                emp = Employee.objects.filter(id=emp_id, organization=organization).first()
            if not emp:
                emp = Employee.objects.filter(
                    organization=organization,
                    full_name__iexact=txn.payee_name.strip(),
                ).first()

            if emp:
                AttendanceSettlementService.settle_by_payment_amount(
                    employee=emp,
                    payment_amount=amount,
                    payment_id=txn_id,
                )

        return txn

    @staticmethod
    @transaction.atomic
    def delete_transaction(transaction_id: str, user, organization) -> dict:
        """
        Step-by-step full reversal on deletion (Section 2.4 C):
        1. Find transaction.
        2. If linked to payment: reverse attendance settlement & credit deduction, delete payment.
        3. If standalone salary: reverse attendance settlement.
        4. If outgoing cash: reverse credit deduction.
        5. Delete transaction.
        """
        txn = Transaction.objects.filter(
            organization=organization,
            transaction_id=transaction_id,
            deleted_at__isnull=True,
        ).first()

        if not txn:
            raise BusinessRuleError("Transaction not found.", code="transaction_not_found")

        meta = txn.metadata or {}
        payment_id = meta.get("paymentId")

        # 2. Linked payment reversal
        if payment_id:
            from payroll.models import Payment

            pay = Payment.objects.filter(id=payment_id, organization=organization).first()
            if pay:
                AttendanceSettlementService.reverse_settlement_by_payment_id(str(pay.id))
                pay.delete()

        # 3. Standalone salary attendance reversal
        if txn.category == TransactionCategory.SALARY:
            AttendanceSettlementService.reverse_settlement_by_payment_id(txn.transaction_id)

        # 4. Outgoing transaction deletion (Cash credit module removed)
        txn.delete()
        return {"status": "reversed_and_deleted", "transaction_id": transaction_id}

    @staticmethod
    def get_summary(organization, user=None) -> dict:
        """Aggregated summary statistics for Payment Central (Section 2.3)."""
        qs = Transaction.objects.filter(organization=organization, deleted_at__isnull=True)
        if user and user.role not in ["ORG_ADMIN", "ACCOUNTANT"]:
            qs = qs.filter(recorded_by=user)

        total_txns = qs.count()
        incoming_txns = qs.filter(type=TransactionType.INCOMING, status=TransactionStatus.COMPLETED)
        outgoing_txns = qs.filter(type=TransactionType.OUTGOING, status=TransactionStatus.COMPLETED)
        pending_txns = qs.filter(status=TransactionStatus.PENDING)

        total_incoming = sum((t.amount for t in incoming_txns), Decimal("0.00"))
        total_outgoing = sum((t.amount for t in outgoing_txns), Decimal("0.00"))
        total_pending = sum((t.amount for t in pending_txns), Decimal("0.00"))
        net_balance = total_incoming - total_outgoing

        return {
            "total_transactions": total_txns,
            "total_incoming": float(total_incoming),
            "total_outgoing": float(total_outgoing),
            "total_pending": float(total_pending),
            "pending_count": pending_txns.count(),
            "net_balance": float(net_balance),
        }

    @staticmethod
    def sync_organization_transactions(organization):
        """
        Synchronizes all financial movements into Payment Central unified ledger from:
        1. Spend & Vendors: Expenses (APPROVED & PENDING_APPROVAL) and Vendor Payments
        2. UPAD & Advances: Worker Advances (payroll.Advance) and UPAD Payments (payroll.Payment)
        3. Payroll: Payroll Vouchers (PAID & PENDING)
        """
        if not organization:
            return

        from expenses.models import (
            Expense,
            ExpenseStatus,
            RunningCost,
            VendorPayment,
        )
        from payroll.models import (
            Advance,
            Payment,
            PaymentLifecycleStatus,
            PayrollVoucher,
            VoucherStatus,
        )

        first_user = organization.users.filter(is_active=True).first() or organization.users.first()
        if not first_user:
            return

        # 1. Sync Expenses (Spend & Vendors)
        expenses = Expense.objects.filter(
            organization=organization,
            deleted_at__isnull=True,
        ).select_related("vendor", "project", "created_by")

        for exp in expenses:
            txn_id = f"TXN-EXP-{exp.id}"
            category = (
                TransactionCategory.VENDOR
                if exp.vendor
                else (
                    TransactionCategory.SITE_COST
                    if exp.category in ["EQUIPMENT_RENTAL", "MATERIAL", "SUBCONTRACTOR"]
                    else TransactionCategory.OTHER
                )
            )
            payee_name = (
                exp.vendor.name
                if exp.vendor
                else (
                    f"Vendor - {exp.get_category_display()}"
                    if exp.category
                    else (exp.description[:50] or "Vendor")
                )
            )

            status_map = {
                ExpenseStatus.APPROVED: TransactionStatus.COMPLETED,
                ExpenseStatus.PENDING_APPROVAL: TransactionStatus.PENDING,
                ExpenseStatus.REJECTED: TransactionStatus.FAILED,
                ExpenseStatus.CANCELLED: TransactionStatus.REFUNDED,
            }
            txn_status = status_map.get(exp.status, TransactionStatus.COMPLETED)

            method_str = str(exp.payment_mode or "CASH").upper()
            method_map = {
                "CASH": TransactionMethod.CASH,
                "BANK_TRANSFER": TransactionMethod.BANK_TRANSFER,
                "UPI": TransactionMethod.UPI,
                "CHEQUE": TransactionMethod.CHEQUE,
                "CREDIT": TransactionMethod.OTHER,
            }
            txn_method = method_map.get(method_str, TransactionMethod.CASH)

            Transaction.objects.update_or_create(
                organization=organization,
                transaction_id=txn_id,
                defaults={
                    "date": exp.expense_date,
                    "type": TransactionType.OUTGOING,
                    "category": category,
                    "payer_name": organization.name,
                    "payee_name": payee_name,
                    "amount": exp.amount,
                    "method": txn_method,
                    "status": txn_status,
                    "description": f"[EXP-{exp.id}] {exp.get_category_display()}: {exp.description}",
                    "recorded_by": exp.created_by or first_user,
                    "metadata": {
                        "source": "expense",
                        "expense_id": exp.id,
                        "project_id": exp.project_id,
                        "category": exp.category,
                    },
                },
            )

        # 2. Sync Vendor Payments (Repayments to vendors)
        vendor_payments = VendorPayment.objects.filter(
            organization=organization,
            deleted_at__isnull=True,
        ).select_related("vendor", "project", "paid_by")

        for vp in vendor_payments:
            txn_id = f"TXN-VP-{vp.id}"
            method_str = (vp.payment_mode or "BANK_TRANSFER").upper()
            method_map = {
                "CASH": TransactionMethod.CASH,
                "BANK_TRANSFER": TransactionMethod.BANK_TRANSFER,
                "UPI": TransactionMethod.UPI,
                "CHEQUE": TransactionMethod.CHEQUE,
            }
            txn_method = method_map.get(method_str, TransactionMethod.BANK_TRANSFER)

            Transaction.objects.update_or_create(
                organization=organization,
                transaction_id=txn_id,
                defaults={
                    "date": vp.payment_date,
                    "type": TransactionType.OUTGOING,
                    "category": TransactionCategory.VENDOR,
                    "payer_name": organization.name,
                    "payee_name": vp.vendor.name,
                    "amount": vp.amount,
                    "method": txn_method,
                    "status": TransactionStatus.COMPLETED,
                    "description": f"[VENDOR-PAY] Repayment to {vp.vendor.name}: {vp.reference or vp.notes or 'Vendor payment'}",
                    "recorded_by": vp.paid_by or first_user,
                    "metadata": {
                        "source": "vendor_payment",
                        "vendor_payment_id": vp.id,
                        "vendor_id": vp.vendor_id,
                    },
                },
            )

        # 3. Sync UPAD Payments (payroll.Payment)
        payments = Payment.objects.filter(
            organization=organization,
            deleted_at__isnull=True,
        ).select_related("employee", "project", "created_by", "processed_by")

        for p in payments:
            txn_id = p.transaction_id or f"TXN-UPAD-{p.id}"
            p_date = p.date_from or (p.created_at.date() if p.created_at else timezone.now().date())
            payee_name = p.employee.full_name if p.employee else "Staff Member"

            status_map = {
                PaymentLifecycleStatus.PAID: TransactionStatus.COMPLETED,
                PaymentLifecycleStatus.APPROVED: TransactionStatus.PENDING,
                PaymentLifecycleStatus.PENDING: TransactionStatus.PENDING,
                PaymentLifecycleStatus.REJECTED: TransactionStatus.FAILED,
            }
            txn_status = status_map.get(p.status, TransactionStatus.COMPLETED)

            method_str = (p.method or "CASH").upper()
            method_map = {
                "CASH": TransactionMethod.CASH,
                "BANK_TRANSFER": TransactionMethod.BANK_TRANSFER,
                "UPI": TransactionMethod.UPI,
                "CHEQUE": TransactionMethod.CHEQUE,
            }
            txn_method = method_map.get(method_str, TransactionMethod.CASH)

            is_salary = (p.type == PaymentType.SALARY)
            meta_source = "payroll" if is_salary else "upad"
            txn_desc = (
                f"[PAYROLL-{p.id}] Salary payment to {payee_name}: {p.description or 'Wage settlement'}"
                if is_salary
                else f"[UPAD-{p.id}] Advance to {payee_name}: {p.description or 'Worker advance'}"
            )
            txn_ref_id = f"TXN-SAL-{p.id}" if is_salary else txn_id

            Transaction.objects.update_or_create(
                organization=organization,
                transaction_id=txn_ref_id,
                defaults={
                    "date": p_date,
                    "type": TransactionType.OUTGOING,
                    "category": TransactionCategory.SALARY,
                    "payer_name": organization.name,
                    "payee_name": payee_name,
                    "amount": p.amount,
                    "method": txn_method,
                    "status": txn_status,
                    "description": txn_desc,
                    "recorded_by": p.created_by or first_user,
                    "metadata": {
                        "source": meta_source,
                        "paymentId": p.id,
                        "employeeId": getattr(p.employee, "id", None),
                        "paymentType": p.type,
                    },
                },
            )

        # 4. Sync Standalone Worker Advances (payroll.Advance)
        advances = Advance.objects.filter(
            organization=organization,
            deleted_at__isnull=True,
        ).select_related("employee", "project", "given_by")

        for adv in advances:
            # Avoid duplicate if already linked to UPAD Payment
            if adv.reason and "[UPAD-" in adv.reason:
                continue
            if Payment.objects.filter(
                organization=organization,
                employee=adv.employee,
                amount=adv.amount,
                date_from=adv.advance_date,
            ).exists():
                continue

            txn_id = f"TXN-ADV-{adv.id}"
            method_str = (adv.payment_mode or "CASH").upper()
            method_map = {
                "CASH": TransactionMethod.CASH,
                "BANK_TRANSFER": TransactionMethod.BANK_TRANSFER,
                "UPI": TransactionMethod.UPI,
                "CHEQUE": TransactionMethod.CHEQUE,
            }
            txn_method = method_map.get(method_str, TransactionMethod.CASH)

            Transaction.objects.update_or_create(
                organization=organization,
                transaction_id=txn_id,
                defaults={
                    "date": adv.advance_date,
                    "type": TransactionType.OUTGOING,
                    "category": TransactionCategory.SALARY,
                    "payer_name": organization.name,
                    "payee_name": adv.employee.full_name,
                    "amount": adv.amount,
                    "method": txn_method,
                    "status": TransactionStatus.COMPLETED,
                    "description": f"[UPAD] Advance #{adv.id} to {adv.employee.full_name}: {adv.reason or 'Worker advance'}",
                    "recorded_by": adv.given_by or first_user,
                    "metadata": {
                        "source": "upad",
                        "advance_id": adv.id,
                        "employee_id": adv.employee_id,
                    },
                },
            )

        # 5. Sync Payroll Vouchers (Wage disbursements)
        vouchers = PayrollVoucher.objects.filter(
            organization=organization,
            run__status__in=["APPROVED", "PAID"],
        ).select_related("employee", "run")

        for v in vouchers:
            txn_id = f"TXN-VOU-{v.id}"
            v_date = v.paid_at.date() if v.paid_at else v.run.period_end
            method_str = (v.payment_mode or "CASH").upper()
            method_map = {
                "CASH": TransactionMethod.CASH,
                "BANK_TRANSFER": TransactionMethod.BANK_TRANSFER,
                "UPI": TransactionMethod.UPI,
                "CHEQUE": TransactionMethod.CHEQUE,
            }
            txn_method = method_map.get(method_str, TransactionMethod.CASH)
            txn_status = (
                TransactionStatus.COMPLETED
                if v.status == VoucherStatus.PAID
                else TransactionStatus.PENDING
            )

            Transaction.objects.update_or_create(
                organization=organization,
                transaction_id=txn_id,
                defaults={
                    "date": v_date,
                    "type": TransactionType.OUTGOING,
                    "category": TransactionCategory.SALARY,
                    "payer_name": organization.name,
                    "payee_name": v.employee.full_name,
                    "amount": v.net_pay,
                    "method": txn_method,
                    "status": txn_status,
                    "description": f"[PAYROLL] {v.voucher_number} Wage Payout for {v.employee.full_name}",
                    "recorded_by": v.run.created_by or first_user,
                    "metadata": {
                        "source": "payroll",
                        "voucher_id": v.id,
                        "run_id": v.run_id,
                        "voucher_number": v.voucher_number,
                        "employee_id": v.employee_id,
                    },
                },
            )

        # 6. Sync Running Costs (Day-to-day site operational costs)
        running_costs = RunningCost.objects.filter(
            organization=organization,
            deleted_at__isnull=True,
        ).select_related("project", "entered_by")

        for rc in running_costs:
            txn_id = f"TXN-RC-{rc.id}"
            method_str = str(rc.payment_method or "CASH").upper()
            method_map = {
                "CASH": TransactionMethod.CASH,
                "BANK_TRANSFER": TransactionMethod.BANK_TRANSFER,
                "UPI": TransactionMethod.UPI,
                "CHEQUE": TransactionMethod.CHEQUE,
                "CREDIT": TransactionMethod.OTHER,
            }
            txn_method = method_map.get(method_str, TransactionMethod.CASH)

            Transaction.objects.update_or_create(
                organization=organization,
                transaction_id=txn_id,
                defaults={
                    "date": rc.date,
                    "type": TransactionType.OUTGOING,
                    "category": TransactionCategory.SITE_COST,
                    "payer_name": organization.name,
                    "payee_name": rc.user_name or "Site Operational Expense",
                    "amount": rc.amount,
                    "method": txn_method,
                    "status": TransactionStatus.COMPLETED,
                    "description": f"[RUNNING COST] {rc.description}",
                    "recorded_by": rc.entered_by or first_user,
                    "metadata": {
                        "source": "running_cost",
                        "running_cost_id": rc.id,
                        "project_id": rc.project_id,
                    },
                },
            )
