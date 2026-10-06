"""
Payroll views and endpoints.
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsTenantUser
from core.views import ProjectScopedMixin, TenantViewSet
from payroll.models import Advance, PayrollRun, PayrollVoucher
from payroll.serializers import AdvanceSerializer, PayrollRunSerializer, PayrollVoucherSerializer
from payroll.services import (
    approve_run,
    cancel_run,
    create_run,
    mark_voucher_paid,
    recalculate_run,
    record_advance,
)


class AdvanceViewSet(ProjectScopedMixin, TenantViewSet):
    queryset = Advance.objects.all()
    serializer_class = AdvanceSerializer
    permission_classes = [IsAuthenticated, IsTenantUser]
    filterset_fields = ["project", "employee", "status"]

    def get_queryset(self):
        qs = super().get_queryset()
        return self.filter_project_scope(qs)

    def perform_create(self, serializer):
        record_advance(user=self.request.user, data=serializer.validated_data)


class PayrollRunViewSet(ProjectScopedMixin, TenantViewSet):
    queryset = PayrollRun.objects.all()
    serializer_class = PayrollRunSerializer
    permission_classes = [IsAuthenticated, IsTenantUser]
    filterset_fields = ["project", "status"]

    def get_queryset(self):
        qs = super().get_queryset()
        return self.filter_project_scope(qs).prefetch_related("vouchers__employee")

    def create(self, request, *args, **kwargs):
        project_id = request.data.get("project_id")
        start = request.data.get("period_start")
        end = request.data.get("period_end")
        from projects.models import Project

        project = Project.objects.get(organization=request.user.organization, id=project_id)
        run = create_run(user=request.user, project=project, period_start=start, period_end=end)
        return Response(PayrollRunSerializer(run).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="recalculate")
    def recalculate(self, request, pk=None):
        run = self.get_object()
        recalculate_run(run, user=request.user)
        return Response(PayrollRunSerializer(run).data)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        run = self.get_object()
        approve_run(run, approver=request.user)
        return Response(PayrollRunSerializer(run).data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        run = self.get_object()
        reason = request.data.get("reason", "")
        cancel_run(run, user=request.user, reason=reason)
        return Response(PayrollRunSerializer(run).data)


class PayrollVoucherViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PayrollVoucher.objects.all()
    serializer_class = PayrollVoucherSerializer
    permission_classes = [IsAuthenticated, IsTenantUser]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return PayrollVoucher.objects.none()
        return PayrollVoucher.objects.filter(organization=self.request.user.organization)

    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        voucher = self.get_object()
        ref = request.data.get("payment_reference", "")
        mark_voucher_paid(voucher, user=request.user, reference=ref)
        return Response(PayrollVoucherSerializer(voucher).data)
