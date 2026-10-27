"""
Payment Central Service: Central Unified Transaction Ledger.
Directly implements Section 2 of Module Architecture & Workflow Specification.
"""

import logging
import random
import time
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from attendance.services_settlement import AttendanceSettlementService
from core.exceptions import BusinessRuleError
from ledger.models import (
    Transaction,
    TransactionCategory,
    TransactionMethod,
    TransactionStatus,
    TransactionType,
)
from workforce.models import Employee

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

        total_incoming = sum((t.amount for t in incoming_txns), Decimal("0.00"))
        total_outgoing = sum((t.amount for t in outgoing_txns), Decimal("0.00"))
        net_balance = total_incoming - total_outgoing

        return {
            "total_transactions": total_txns,
            "total_incoming": float(total_incoming),
            "total_outgoing": float(total_outgoing),
            "net_balance": float(net_balance),
        }
