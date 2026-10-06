"""
Views for Expenses, Vendors, Payments, and Running Cost Baselines.
Single source of truth for UC-18 through UC-22.
"""

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.exceptions import BusinessRuleError
from core.permissions import IsTenantUser, roles_required
from core.roles import Role
from core.views import ProjectScopedMixin, TenantViewSet
from expenses.models import (
    Expense,
    ExpenseStatus,
    RunningCostBaseline,
    Vendor,
)
from expenses.serializers import (
    ExpenseSerializer,
    RunningCostBaselineSerializer,
    VendorPaymentSerializer,
    VendorSerializer,
)
from expenses.services import (
    approve_expense,
    cancel_expense,
    create_expense,
    record_vendor_payment,
    reject_expense,
    upsert_running_cost_baseline,
    vendor_statement,
)
from projects.models import Project


class ExpenseViewSet(ProjectScopedMixin, TenantViewSet):
    """
    UC-18, UC-19, UC-20, UC-21:
    Manage expenses, credit purchases, utility & transport slips, approvals, and cancellations.
    """

    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated, IsTenantUser]
    filterset_fields = ["project", "category", "status", "payment_mode", "vendor", "created_by"]
    search_fields = ["description", "invoice_number"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Expense.objects.none()

        qs = super().get_queryset().select_related("project", "vendor", "created_by", "approved_by")
        qs = self.filter_project_scope(qs)

        # Optional date range filtering
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(expense_date__gte=date_from)
        if date_to:
            qs = qs.filter(expense_date__lte=date_to)

        return qs

    def create(self, request, *args, **kwargs):
        """Log an expense with receipt, credit purchase, or transport/utility slip."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        expense = create_expense(
            user=request.user,
            data=serializer.validated_data,
            request=request,
        )
        return Response(
            self.get_serializer(expense).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        """PATCH / PUT allowed only while PENDING_APPROVAL by creator (or ADM/PM)."""
        expense = self.get_object()
        if expense.status != ExpenseStatus.PENDING_APPROVAL:
            raise BusinessRuleError(
                "Only PENDING_APPROVAL expenses can be modified.",
                code="invalid_status",
            )
        if (
            request.user.role not in [Role.ORG_ADMIN, Role.PROJECT_MANAGER]
            and expense.created_by_id != request.user.id
        ):
            raise PermissionDenied("You do not have permission to modify this expense.")

        return super().update(request, *args, **kwargs)

    @action(
        detail=True,
        methods=["post"],
        url_path="approve",
        permission_classes=[roles_required(Role.PROJECT_MANAGER, Role.ORG_ADMIN)],
    )
    def approve(self, request, pk=None):
        """UC-20: PM or ADM approves an expense. Approver cannot be the creator."""
        expense = self.get_object()
        updated = approve_expense(expense, approver=request.user, request=request)
        return Response(self.get_serializer(updated).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="reject",
        permission_classes=[roles_required(Role.PROJECT_MANAGER, Role.ORG_ADMIN)],
    )
    def reject(self, request, pk=None):
        """UC-20: PM or ADM rejects an expense with mandatory reason."""
        expense = self.get_object()
        reason = request.data.get("reason", "")
        updated = reject_expense(expense, approver=request.user, reason=reason, request=request)
        return Response(self.get_serializer(updated).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="cancel",
        permission_classes=[roles_required(Role.PROJECT_MANAGER, Role.ORG_ADMIN)],
    )
    def cancel(self, request, pk=None):
        """UC-20: PM or ADM cancels an approved expense, reversing journal and spend."""
        expense = self.get_object()
        reason = request.data.get("reason", "")
        updated = cancel_expense(expense, user=request.user, reason=reason, request=request)
        return Response(self.get_serializer(updated).data)


class VendorViewSet(TenantViewSet):
    """
    UC-19, UC-22:
    Manage vendors, view vendor ledger/statements, and record repayments.
    """

    queryset = Vendor.objects.all()
    serializer_class = VendorSerializer
    permission_classes = [IsAuthenticated, IsTenantUser]
    filterset_fields = ["is_active"]
    search_fields = ["name", "contact_person", "tax_id"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Vendor.objects.none()
        return Vendor.objects.filter(
            organization=self.request.user.organization,
            deleted_at__isnull=True,
        )

    @action(
        detail=True,
        methods=["get"],
        url_path="ledger",
        permission_classes=[roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER, Role.ACCOUNTANT)],
    )
    def ledger(self, request, pk=None):
        """UC-22: Chronological statement of credit purchases and payments with running balance."""
        vendor = self.get_object()
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        statement = vendor_statement(vendor, date_from=date_from, date_to=date_to)
        return Response(statement)

    @action(
        detail=True,
        methods=["get", "post"],
        url_path="payments",
        permission_classes=[roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER, Role.ACCOUNTANT)],
    )
    def payments(self, request, pk=None):
        """UC-22: GET list of repayments or POST a new vendor repayment up to balance."""
        vendor = self.get_object()
        if request.method == "GET":
            qs = vendor.payments.filter(deleted_at__isnull=True).order_by("-payment_date")
            return Response(VendorPaymentSerializer(qs, many=True).data)

        # POST repayment
        serializer = VendorPaymentSerializer(
            data=request.data, context=self.get_serializer_context()
        )
        serializer.is_valid(raise_exception=True)
        payment = record_vendor_payment(
            vendor=vendor,
            user=request.user,
            data=serializer.validated_data,
            request=request,
        )
        return Response(VendorPaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class RunningCostBaselineViewSet(ProjectScopedMixin, TenantViewSet):
    """
    UC-21:
    List and upsert monthly utility baselines per project.
    """

    queryset = RunningCostBaseline.objects.all()
    serializer_class = RunningCostBaselineSerializer
    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER, Role.ACCOUNTANT),
    ]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return RunningCostBaseline.objects.none()
        qs = super().get_queryset().select_related("project")
        return self.filter_project_scope(qs)

    @action(detail=False, methods=["put"], url_path="upsert")
    def upsert(self, request):
        """Upsert a baseline for a project and utility type."""
        project_id = request.data.get("project")
        utility_type = request.data.get("utility_type")
        monthly_baseline = request.data.get("monthly_baseline")

        if not project_id or not utility_type or monthly_baseline is None:
            raise BusinessRuleError(
                "project, utility_type, and monthly_baseline are required for upsert.",
                code="missing_fields",
            )

        try:
            project = Project.objects.get(
                organization=request.user.organization,
                id=project_id,
            )
        except Project.DoesNotExist:
            raise BusinessRuleError("Project not found.", code="project_not_found")

        baseline = upsert_running_cost_baseline(
            org=request.user.organization,
            project=project,
            utility_type=utility_type,
            monthly_baseline=monthly_baseline,
        )
        return Response(RunningCostBaselineSerializer(baseline).data, status=status.HTTP_200_OK)
