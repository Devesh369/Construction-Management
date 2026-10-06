"""
Workforce views: Employee directory and LaborGroup management.
"""

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsTenantUser
from core.views import TenantViewSet
from workforce.models import Employee, LaborGroup
from workforce.serializers import EmployeeSerializer, LaborGroupSerializer
from workforce.services import generate_employee_code


class EmployeeViewSet(TenantViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated, IsTenantUser]
    filterset_fields = ["trade", "primary_project", "group", "employment_type", "is_active"]
    search_fields = ["full_name", "employee_code", "phone"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Employee.objects.none()
        return Employee.objects.filter(
            organization=self.request.user.organization,
            deleted_at__isnull=True,
        )

    def perform_create(self, serializer):
        code = serializer.validated_data.get("employee_code")
        if not code:
            code = generate_employee_code(self.request.user.organization)
        serializer.save(
            organization=self.request.user.organization,
            employee_code=code,
        )


class LaborGroupViewSet(TenantViewSet):
    queryset = LaborGroup.objects.all()
    serializer_class = LaborGroupSerializer
    permission_classes = [IsAuthenticated, IsTenantUser]
    filterset_fields = ["project", "is_active"]
    search_fields = ["name"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return LaborGroup.objects.none()
        return LaborGroup.objects.filter(
            organization=self.request.user.organization,
            deleted_at__isnull=True,
        )

    @action(detail=True, methods=["post"], url_path="members")
    def add_members(self, request, pk=None):
        group = self.get_object()
        employee_ids = request.data.get("employee_ids", [])
        Employee.objects.filter(
            organization=request.user.organization,
            id__in=employee_ids,
        ).update(group=group)
        return Response({"status": "members_added", "count": len(employee_ids)})

    @action(detail=True, methods=["delete"], url_path="members/(?P<employee_id>[^/.]+)")
    def remove_member(self, request, pk=None, employee_id=None):
        group = self.get_object()
        Employee.objects.filter(
            organization=request.user.organization,
            group=group,
            id=employee_id,
        ).update(group=None)
        return Response(status=status.HTTP_204_NO_CONTENT)
