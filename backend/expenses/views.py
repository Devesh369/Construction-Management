"""
Expenses and Vendor views.
"""

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsTenantUser, roles_required
from core.roles import Role
from core.views import ProjectScopedMixin, TenantViewSet
from expenses.models import Expense, RunningCostBaseline, Vendor
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
)


class ExpenseViewSet(ProjectScopedMixin, TenantViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated, IsTenantUser]
    filterset_fields = ["project", "category", "status", "payment_mode", "vendor"]
    search_fields = ["description", "invoice_number"]

    def get_queryset(self):
        qs = super().get_queryset()
        return self.filter_project_scope(qs)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        expense = create_expense(user=request.user, data=serializer.validated_data)
        return Response(ExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["post"],
        url_path="approve",
        permission_classes=[roles_required(Role.PROJECT_MANAGER, Role.ORG_ADMIN)],
    )
    def approve(self, request, pk=None):
        expense = self.get_object()
        updated = approve_expense(expense, approver=request.user)
        return Response(ExpenseSerializer(updated).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="reject",
        permission_classes=[roles_required(Role.PROJECT_MANAGER, Role.ORG_ADMIN)],
    )
    def reject(self, request, pk=None):
        expense = self.get_object()
        reason = request.data.get("reason", "")
        updated = reject_expense(expense, approver=request.user, reason=reason)
        return Response(ExpenseSerializer(updated).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="cancel",
        permission_classes=[roles_required(Role.PROJECT_MANAGER, Role.ORG_ADMIN)],
    )
    def cancel(self, request, pk=None):
        expense = self.get_object()
        reason = request.data.get("reason", "")
        updated = cancel_expense(expense, user=request.user, reason=reason)
        return Response(ExpenseSerializer(updated).data)


class VendorViewSet(TenantViewSet):
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

    @action(detail=True, methods=["get", "post"], url_path="payments")
    def payments(self, request, pk=None):
        vendor = self.get_object()
        if request.method == "GET":
            qs = vendor.payments.all()
            return Response(VendorPaymentSerializer(qs, many=True).data)

        # POST: Record vendor repayment
        serializer = VendorPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = record_vendor_payment(
            vendor=vendor, user=request.user, data=serializer.validated_data
        )
        return Response(VendorPaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class RunningCostBaselineViewSet(ProjectScopedMixin, TenantViewSet):
    queryset = RunningCostBaseline.objects.all()
    serializer_class = RunningCostBaselineSerializer
    permission_classes = [IsAuthenticated, IsTenantUser]

    def get_queryset(self):
        qs = super().get_queryset()
        return self.filter_project_scope(qs)
