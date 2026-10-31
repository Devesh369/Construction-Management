"""
Views for Payment Central (Transaction Ledger).
Directly implements Section 2.3, 2.4, and 2.5 of Module Architecture & Workflow Specification.
"""

from attendance.services_settlement import AttendanceSettlementService
from core.permissions import IsTenantUser, roles_required
from core.roles import Role
from core.views import TenantViewSet
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from workforce.models import Employee

from ledger.models import Transaction
from ledger.serializers_transactions import TransactionSerializer
from ledger.services_transactions import TransactionService


class TransactionViewSet(TenantViewSet):
    """
    Payment Central: Central Unified Financial Ledger.
    """

    queryset = Transaction.objects.all().select_related("recorded_by")
    serializer_class = TransactionSerializer
    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ORG_ADMIN, Role.ACCOUNTANT),
    ]

    def get_queryset(self):
        user = self.request.user
        org = getattr(user, "organization", None)
        if org:
            try:
                TransactionService.sync_organization_transactions(org)
            except Exception:
                pass

        qs = super().get_queryset()

        # Role-based visibility: regular admins cannot see super_admin transactions (Section 2.1)
        if user.role not in [Role.ORG_ADMIN, Role.ACCOUNTANT]:
            qs = qs.exclude(recorded_by__role=Role.ORG_ADMIN)

        txn_type = self.request.query_params.get("type")
        category = self.request.query_params.get("category")
        status_filter = self.request.query_params.get("status")
        payee_name = self.request.query_params.get("payeeName") or self.request.query_params.get(
            "payee_name"
        )
        from_date = self.request.query_params.get("dateFrom") or self.request.query_params.get(
            "from_date"
        )
        to_date = self.request.query_params.get("dateTo") or self.request.query_params.get(
            "to_date"
        )
        search = self.request.query_params.get("search")
        module = self.request.query_params.get("module")

        if txn_type:
            qs = qs.filter(type=txn_type)
        if category:
            qs = qs.filter(category=category)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if payee_name:
            qs = qs.filter(payee_name__icontains=payee_name)
        if from_date:
            qs = qs.filter(date__gte=from_date)
        if to_date:
            qs = qs.filter(date__lte=to_date)
        admin_filter = self.request.query_params.get("admin") or self.request.query_params.get(
            "recorded_by"
        )
        if admin_filter:
            if str(admin_filter).isdigit():
                qs = qs.filter(recorded_by_id=int(admin_filter))
            else:
                qs = qs.filter(
                    recorded_by__name__icontains=admin_filter
                ) | qs.filter(recorded_by__email__icontains=admin_filter)
        if module:
            if module == "spend_vendor":
                qs = qs.filter(metadata__source__in=["expense", "vendor_payment", "running_cost"])
            elif module == "upad":
                qs = qs.filter(metadata__source="upad")
            elif module == "payroll":
                qs = qs.filter(metadata__source="payroll")
        if search:
            qs = (
                qs.filter(description__icontains=search)
                | qs.filter(payee_name__icontains=search)
                | qs.filter(payer_name__icontains=search)
                | qs.filter(transaction_id__icontains=search)
            )

        return qs

    def list(self, request, *args, **kwargs):
        """Enriched view calculating netPayableBalance for employee payees (Section 2.4 B)."""
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        transactions = page if page is not None else queryset

        # Enrich each transaction with net payable balance if payee matches employee
        org = request.user.organization
        serializer = self.get_serializer(transactions, many=True)
        data = serializer.data

        # Cache employee remaining salaries to avoid redundant queries
        emp_map = {
            e.full_name.strip().lower(): e
            for e in Employee.objects.filter(organization=org, deleted_at__isnull=True)
        }

        for item in data:
            payee = (item.get("payee_name") or "").strip().lower()
            if payee in emp_map:
                rem = AttendanceSettlementService.get_remaining_salary(emp_map[payee])
                item["net_payable_balance"] = rem["remaining_salary"]
            else:
                item["net_payable_balance"] = None

        if page is not None:
            return self.get_paginated_response(data)
        return Response(data)

    def create(self, request, *args, **kwargs):
        """Create a new transaction in Payment Central (Section 2.4 A)."""
        txn = TransactionService.create_transaction(
            data=request.data,
            user=request.user,
            organization=request.user.organization,
        )
        serializer = self.get_serializer(txn)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Aggregated financial summary (Section 2.3)."""
        org = getattr(request.user, "organization", None)
        if org:
            try:
                TransactionService.sync_organization_transactions(org)
            except Exception:
                pass

        data = TransactionService.get_summary(
            organization=request.user.organization,
            user=request.user,
        )
        return Response(data, status=status.HTTP_200_OK)

    def partial_update(self, request, *args, **kwargs):
        """Update transaction status or fields (Super Admin / Admin)."""
        txn = self.get_object()
        new_status = request.data.get("status")
        if new_status:
            txn.status = str(new_status).lower().strip()
            txn.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(txn).data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """Delete with full reversal (Section 2.4 C - Super Admin / Admin)."""
        txn = self.get_object()
        res = TransactionService.delete_transaction(
            transaction_id=txn.transaction_id,
            user=request.user,
            organization=request.user.organization,
        )
        return Response(res, status=status.HTTP_200_OK)
