"""
Attendance views and endpoints.
"""

from rest_framework.permissions import IsAuthenticated

from attendance.models import Attendance, Holiday, NightShiftSession
from attendance.serializers import (
    AttendanceSerializer,
    HolidaySerializer,
    NightShiftSessionSerializer,
)
from core.permissions import IsTenantUser
from core.views import ProjectScopedMixin, TenantViewSet


class AttendanceViewSet(ProjectScopedMixin, TenantViewSet):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated, IsTenantUser]
    filterset_fields = ["project", "date", "status", "is_locked"]

    def get_queryset(self):
        qs = super().get_queryset()
        return self.filter_project_scope(qs)


class HolidayViewSet(TenantViewSet):
    queryset = Holiday.objects.all()
    serializer_class = HolidaySerializer
    permission_classes = [IsAuthenticated, IsTenantUser]
    filterset_fields = ["project", "date", "is_paid"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Holiday.objects.none()
        return Holiday.objects.filter(organization=self.request.user.organization)


class NightShiftSessionViewSet(ProjectScopedMixin, TenantViewSet):
    queryset = NightShiftSession.objects.all()
    serializer_class = NightShiftSessionSerializer
    permission_classes = [IsAuthenticated, IsTenantUser]
    filterset_fields = ["project", "shift_date", "status"]

    def get_queryset(self):
        qs = super().get_queryset()
        return self.filter_project_scope(qs)
