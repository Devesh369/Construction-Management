"""
Daily Progress Reports views.
"""

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsTenantUser, roles_required
from core.roles import Role
from core.views import ProjectScopedMixin, TenantViewSet
from progress.models import DailyProgressReport, DPRStatus
from progress.serializers import DailyProgressReportSerializer
from progress.services import calculate_project_progress


class DailyProgressReportViewSet(ProjectScopedMixin, TenantViewSet):
    queryset = DailyProgressReport.objects.all()
    serializer_class = DailyProgressReportSerializer
    permission_classes = [IsAuthenticated, IsTenantUser]
    filterset_fields = ["project", "status", "report_date"]
    ordering_fields = ["report_date"]
    ordering = ["-report_date"]

    def get_queryset(self):
        qs = super().get_queryset()
        return self.filter_project_scope(qs)

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.user.organization,
            submitted_by=self.request.user,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="verify",
        permission_classes=[roles_required(Role.PROJECT_MANAGER, Role.ORG_ADMIN)],
    )
    def verify_report(self, request, pk=None):
        dpr = self.get_object()
        dpr.status = DPRStatus.VERIFIED
        dpr.verified_by = request.user
        dpr.verified_at = timezone.now()
        dpr.save(update_fields=["status", "verified_by", "verified_at", "updated_at"])

        # Recalculate project progress
        calculate_project_progress(dpr.project)
        return Response(DailyProgressReportSerializer(dpr).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="reject",
        permission_classes=[roles_required(Role.PROJECT_MANAGER, Role.ORG_ADMIN)],
    )
    def reject_report(self, request, pk=None):
        dpr = self.get_object()
        reason = request.data.get("reason")
        if not reason:
            return Response(
                {"error": {"code": "validation_error", "message": "Rejection reason is required."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        dpr.status = DPRStatus.REJECTED
        dpr.rejection_reason = reason
        dpr.verified_by = request.user
        dpr.verified_at = timezone.now()
        dpr.save(
            update_fields=["status", "rejection_reason", "verified_by", "verified_at", "updated_at"]
        )
        return Response(DailyProgressReportSerializer(dpr).data)
