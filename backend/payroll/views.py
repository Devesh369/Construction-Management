"""
Views for Worker Advances, Payroll Runs, and Itemized Vouchers.
Single source of truth for UC-23, UC-24, and UC-25.
"""

from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsTenantUser, roles_required
from core.roles import Role
from core.views import ProjectScopedMixin, TenantViewSet
from payroll.models import Advance, PayrollRun, PayrollVoucher
from payroll.serializers import (
    AdvanceSerializer,
    PayrollRunCreateSerializer,
    PayrollRunSerializer,
    PayrollVoucherSerializer,
    PayrollVoucherUpdateSerializer,
)
from payroll.services import (
    approve_run,
    cancel_run,
    create_run,
    generate_voucher_pdf,
    mark_voucher_paid,
    recalculate_run,
    record_advance,
    update_voucher,
)
from projects.models import Project


class AdvanceViewSet(ProjectScopedMixin, TenantViewSet):
    """
    UC-23: Worker cash advances and asset tracking.
    """

    queryset = Advance.objects.all()
    serializer_class = AdvanceSerializer
    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ACCOUNTANT, Role.PROJECT_MANAGER, Role.ORG_ADMIN, Role.SUPERVISOR),
    ]
    filterset_fields = ["project", "employee", "status", "payment_mode"]
    search_fields = ["employee__full_name", "employee__employee_code", "reason"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Advance.objects.none()
        qs = super().get_queryset().select_related("employee", "project", "given_by")
        return self.filter_project_scope(qs)

    def create(self, request, *args, **kwargs):
        """Record a cash advance given to a worker."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        adv = record_advance(user=request.user, data=serializer.validated_data, request=request)
        return Response(self.get_serializer(adv).data, status=status.HTTP_201_CREATED)


class PayrollRunViewSet(ProjectScopedMixin, TenantViewSet):
    """
    UC-24, UC-25: Payroll calculation, recalculation, approval, and cancellation.
    """

    queryset = PayrollRun.objects.all()
    serializer_class = PayrollRunSerializer
    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ACCOUNTANT, Role.PROJECT_MANAGER, Role.ORG_ADMIN),
    ]
    filterset_fields = ["project", "status"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return PayrollRun.objects.none()
        qs = super().get_queryset().select_related("project", "created_by", "approved_by")
        qs = qs.prefetch_related("vouchers__employee")
        return self.filter_project_scope(qs)

    def create(self, request, *args, **kwargs):
        """UC-24: Create a new DRAFT payroll run for a project and date period."""
        create_serializer = PayrollRunCreateSerializer(data=request.data)
        create_serializer.is_valid(raise_exception=True)

        data = create_serializer.validated_data
        project = Project.objects.get(
            organization=request.user.organization,
            id=data["project_id"],
        )

        run, warnings = create_run(
            user=request.user,
            project=project,
            period_start=data["period_start"],
            period_end=data["period_end"],
            request=request,
        )

        serialized = PayrollRunSerializer(run).data
        serialized["warnings"] = warnings
        return Response(serialized, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="recalculate")
    def recalculate(self, request, pk=None):
        """UC-24: Recompute all vouchers in a DRAFT run from current locked attendance and advances."""
        run = self.get_object()
        warnings = recalculate_run(run, user=request.user)
        serialized = PayrollRunSerializer(run).data
        serialized["warnings"] = warnings
        return Response(serialized)

    @action(
        detail=True,
        methods=["post"],
        url_path="approve",
        permission_classes=[roles_required(Role.ORG_ADMIN, Role.ACCOUNTANT, Role.PROJECT_MANAGER)],
    )
    def approve(self, request, pk=None):
        """UC-25: Approve run, post balanced journal, adjust advances FIFO, and update spend."""
        run = self.get_object()
        approved = approve_run(run, approver=request.user, request=request)
        return Response(PayrollRunSerializer(approved).data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        """UC-25: Cancel a DRAFT or APPROVED payroll run."""
        run = self.get_object()
        reason = request.data.get("reason", "")
        cancelled = cancel_run(run, user=request.user, reason=reason, request=request)
        return Response(PayrollRunSerializer(cancelled).data)


class PayrollVoucherViewSet(TenantViewSet):
    """
    UC-24, UC-25: Itemized worker vouchers, editable deductions, payout tracking, and PDF download.
    """

    queryset = PayrollVoucher.objects.all()
    serializer_class = PayrollVoucherSerializer
    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ACCOUNTANT, Role.PROJECT_MANAGER, Role.ORG_ADMIN),
    ]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return PayrollVoucher.objects.none()
        return (
            PayrollVoucher.objects.filter(organization=self.request.user.organization)
            .select_related("employee", "run__project")
            .order_by("id")
        )

    def partial_update(self, request, *args, **kwargs):
        """PATCH payroll/vouchers/{id}: Adjust advances_deducted or payment_mode in a DRAFT run."""
        voucher = self.get_object()
        serializer = PayrollVoucherUpdateSerializer(voucher, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = update_voucher(voucher, user=request.user, data=serializer.validated_data)
        return Response(PayrollVoucherSerializer(updated).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="mark-paid",
        permission_classes=[roles_required(Role.ACCOUNTANT, Role.ORG_ADMIN)],
    )
    def mark_paid(self, request, pk=None):
        """UC-25: Mark individual voucher as PAID with payment reference."""
        voucher = self.get_object()
        ref = request.data.get("payment_reference", "")
        paid = mark_voucher_paid(voucher, user=request.user, reference=ref, request=request)
        return Response(PayrollVoucherSerializer(paid).data)

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, pk=None):
        """UC-25: Generate and download printable wage voucher PDF."""
        voucher = self.get_object()
        pdf_bytes = generate_voucher_pdf(voucher)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        filename = f"voucher_{voucher.voucher_number}.pdf"
        response["Content-Disposition"] = f'inline; filename="{filename}"'
        return response
