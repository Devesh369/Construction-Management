"""
Views for Credits Module (Cash Credit Management & FIFO Deductions).
Directly implements Section 4.3, 4.4, 4.5, and 4.6 of Module Architecture & Workflow Specification.
"""

from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsTenantUser, roles_required
from core.roles import Role
from core.views import TenantViewSet
from core.exceptions import BusinessRuleError
from expenses.models import CreditLog, CreditLogExpense, CreditLogStatus
from expenses.serializers_credits import CreditLogSerializer, CreditLogExpenseSerializer
from expenses.services_credits import CreditLogsService


class CreditLogViewSet(TenantViewSet):
    """
    Credits Module: Manages cash pool available to each admin for site disbursement.
    """
    queryset = CreditLog.objects.all().select_related("credited_by", "project", "employee").prefetch_related("expenses")
    serializer_class = CreditLogSerializer
    permission_classes = [IsAuthenticated, IsTenantUser]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        # Admins see only their own entries unless ORG_ADMIN or ACCOUNTANT
        if user.role not in [Role.ORG_ADMIN, Role.ACCOUNTANT]:
            qs = qs.filter(credited_by=user)

        status_filter = self.request.query_params.get("status")
        credited_by_id = self.request.query_params.get("creditedBy") or self.request.query_params.get("credited_by")
        search = self.request.query_params.get("search")

        if status_filter:
            qs = qs.filter(status=status_filter)
        if credited_by_id:
            qs = qs.filter(credited_by_id=credited_by_id)
        if search:
            qs = qs.filter(
                description__icontains=search
            ) | qs.filter(
                individual_name__icontains=search
            ) | qs.filter(
                category__icontains=search
            )

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        credited_by = serializer.validated_data.get("credited_by") or user
        amount = serializer.validated_data.get("amount", Decimal("0.00"))
        serializer.save(
            organization=user.organization,
            credited_by=credited_by,
            amount_spent=Decimal("0.00"),
            remaining_balance=amount,
            status=CreditLogStatus.ACTIVE,
        )

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Summary statistics for cash credits (Section 4.3)."""
        data = CreditLogsService.get_summary(
            organization=request.user.organization,
            user=request.user,
        )
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="expenses")
    def add_expense(self, request, pk=None):
        """Manually add an expense against a credit log (Section 4.4 C)."""
        credit_log = self.get_object()
        amount = Decimal(str(request.data.get("amount", "0.00")))
        description = request.data.get("description", "").strip()
        date = request.data.get("date")

        if not description:
            return Response({"error": "Description is required."}, status=status.HTTP_400_BAD_REQUEST)

        exp = CreditLogsService.add_manual_expense(
            credit_log=credit_log,
            user=request.user,
            amount=amount,
            description=description,
            date=date,
        )
        return Response(CreditLogExpenseSerializer(exp).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"expenses/(?P<expense_id>[^/.]+)")
    def remove_expense(self, request, pk=None, expense_id=None):
        """Remove an expense from a credit log with cascade cleanup (Section 4.4 E)."""
        credit_log = self.get_object()
        expense = CreditLogExpense.objects.filter(
            id=expense_id, credit_log=credit_log, deleted_at__isnull=True
        ).first()

        if not expense:
            return Response({"error": "Expense not found."}, status=status.HTTP_404_NOT_FOUND)

        txn_id = expense.transaction_id
        expense.delete()

        # Recalculate credit log
        all_expenses = sum((e.amount for e in credit_log.expenses.filter(deleted_at__isnull=True)), Decimal("0.00"))
        credit_log.amount_spent = all_expenses
        credit_log.remaining_balance = credit_log.amount - credit_log.amount_spent
        if credit_log.status == CreditLogStatus.FULLY_UTILIZED and credit_log.remaining_balance > Decimal("0.00"):
            credit_log.status = CreditLogStatus.ACTIVE
        credit_log.save()

        # Unlink linked transaction if present (Section 4.4 E)
        if txn_id:
            from ledger.services_transactions import TransactionService
            try:
                TransactionService.delete_transaction(txn_id, request.user, request.user.organization)
            except Exception:
                pass

        return Response({"status": "expense_removed", "expense_id": expense_id}, status=status.HTTP_200_OK)
