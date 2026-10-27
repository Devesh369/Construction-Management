"""
Credits Module Services: Cash Credit Management and FIFO Deductions.
Directly implements Section 4 and Section 4.5 of Module Architecture & Workflow Specification.
"""

from decimal import Decimal
import logging
from django.db import transaction
from django.utils import timezone
from core.exceptions import BusinessRuleError
from expenses.models import CreditLog, CreditLogExpense, CreditLogStatus, PaymentMode

logger = logging.getLogger(__name__)


class CreditLogsService:
    @staticmethod
    @transaction.atomic
    def deduct_credit(organization, user, amount: Decimal, description: str, date, transaction_id: str = "") -> list:
        """
        FIFO Deduction Algorithm (Section 4.5):
        When an admin makes a cash payment, the system deducts from the oldest active credit log first.
        """
        amount = Decimal(str(amount))
        if amount <= Decimal("0.00"):
            return []

        # 1. Query: Find all credit logs WHERE status='active', remainingBalance > 0, creditedBy = userId. Sort by transactionDate ASC.
        active_logs = list(
            CreditLog.objects.select_for_update()
            .filter(
                organization=organization,
                credited_by=user,
                status=CreditLogStatus.ACTIVE,
                remaining_balance__gt=Decimal("0.00"),
                deleted_at__isnull=True,
            )
            .order_by("transaction_date", "id")
        )

        # 2. Sum totalAvailable = SUM(remainingBalance) across all logs
        total_available = sum((log.remaining_balance for log in active_logs), Decimal("0.00"))

        # 3. If requestedAmount > totalAvailable: THROW 'Insufficient credit balance'
        if amount > total_available:
            raise BusinessRuleError(
                f"Insufficient cash credit balance. Required: ₹{amount:,.2f}, Available: ₹{total_available:,.2f}. "
                "Please add cash credit to the admin account before proceeding.",
                code="insufficient_credit_balance",
            )

        # 4. Initialize remainingToDeduct
        remaining_to_deduct = amount
        created_expenses = []

        # 5. FOR each credit log (oldest first):
        for log in active_logs:
            balance = log.remaining_balance
            deduction = min(remaining_to_deduct, balance)

            if deduction <= Decimal("0.00"):
                continue

            # c) Create expense sub-doc
            exp = CreditLogExpense.objects.create(
                organization=organization,
                credit_log=log,
                amount=deduction,
                description=description,
                date=date,
                recorded_by=user,
                transaction_id=transaction_id or "",
            )
            created_expenses.append(exp)

            # d) Recalculate amountSpent and remainingBalance
            all_expenses_sum = sum(
                (e.amount for e in log.expenses.filter(deleted_at__isnull=True)),
                Decimal("0.00"),
            )
            log.amount_spent = all_expenses_sum
            log.remaining_balance = log.amount - log.amount_spent
            log.last_expense_date = date

            # e) If remainingBalance <= 0: status = 'fully_utilized'
            if log.remaining_balance <= Decimal("0.00"):
                log.status = CreditLogStatus.FULLY_UTILIZED

            log.save()

            # f) Decrement remaining to deduct
            remaining_to_deduct -= deduction

            # g) If remainingToDeduct <= 0: BREAK
            if remaining_to_deduct <= Decimal("0.00"):
                break

        return created_expenses

    @staticmethod
    @transaction.atomic
    def reverse_credit_deduction(organization, transaction_id: str = "", description: str = "", amount: Decimal = None):
        """
        Credit Reversal (Section 4.4 D):
        Finds matching credit expenses by transactionId or description, removes them,
        recalculates remainingBalance, and reverts status from fully_utilized to active.
        """
        query = CreditLogExpense.objects.filter(organization=organization, deleted_at__isnull=True)
        if transaction_id:
            expenses = list(query.filter(transaction_id=transaction_id))
        elif description:
            expenses = list(query.filter(description__icontains=description))
            if amount is not None:
                expenses = [e for e in expenses if abs(e.amount - Decimal(str(amount))) < Decimal("0.01")]
        else:
            return

        affected_logs = set()
        for exp in expenses:
            log = exp.credit_log
            affected_logs.add(log)
            exp.delete()

        for log in affected_logs:
            all_expenses_sum = sum(
                (e.amount for e in log.expenses.filter(deleted_at__isnull=True)),
                Decimal("0.00"),
            )
            log.amount_spent = all_expenses_sum
            log.remaining_balance = log.amount - log.amount_spent
            if log.status == CreditLogStatus.FULLY_UTILIZED and log.remaining_balance > Decimal("0.00"):
                log.status = CreditLogStatus.ACTIVE
            log.save()

    @staticmethod
    @transaction.atomic
    def add_manual_expense(credit_log, user, amount: Decimal, description: str, date) -> CreditLogExpense:
        """Manual expense against a specific credit log (Section 4.4 C)."""
        amount = Decimal(str(amount))
        if amount > credit_log.remaining_balance:
            raise BusinessRuleError(
                f"Expense amount (₹{amount:,.2f}) exceeds remaining credit balance (₹{credit_log.remaining_balance:,.2f}).",
                code="insufficient_credit_balance",
            )

        exp = CreditLogExpense.objects.create(
            organization=credit_log.organization,
            credit_log=credit_log,
            amount=amount,
            description=description,
            date=date,
            recorded_by=user,
        )

        credit_log.amount_spent += amount
        credit_log.remaining_balance = credit_log.amount - credit_log.amount_spent
        credit_log.last_expense_date = date
        if credit_log.remaining_balance <= Decimal("0.00"):
            credit_log.status = CreditLogStatus.FULLY_UTILIZED
        credit_log.save()
        return exp

    @staticmethod
    def get_summary(organization, user=None) -> dict:
        """Summary statistics for credits module (Section 4.6)."""
        qs = CreditLog.objects.filter(organization=organization, deleted_at__isnull=True)
        if user and user.role not in ["ORG_ADMIN", "ACCOUNTANT"]:
            qs = qs.filter(credited_by=user)

        total_txns = qs.count()
        total_credited = sum((c.amount for c in qs), Decimal("0.00"))
        total_spent = sum((c.amount_spent for c in qs), Decimal("0.00"))
        remaining_balance = sum((c.remaining_balance for c in qs), Decimal("0.00"))
        avg_credit = (total_credited / total_txns) if total_txns > 0 else Decimal("0.00")
        active_pools = qs.filter(status=CreditLogStatus.ACTIVE).count()

        return {
            "total_transactions": total_txns,
            "total_credited": float(total_credited),
            "total_spent": float(total_spent),
            "remaining_balance": float(remaining_balance),
            "avg_credit": float(avg_credit),
            "active_pools": active_pools,
        }
