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
from workforce.services import (
    add_gang_members,
    create_employee,
    delete_labor_group,
    remove_gang_member,
    update_employee,
)


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
        ).select_related("primary_project", "group")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employee = create_employee(
            org=request.user.organization,
            data=serializer.validated_data,
            user=request.user,
            request=request,
        )
        return Response(self.get_serializer(employee).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        updated = update_employee(
            employee=instance,
            data=serializer.validated_data,
            user=request.user,
            request=request,
        )
        return Response(self.get_serializer(updated).data)


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
        ).select_related("project", "leader")

    def perform_destroy(self, instance):
        delete_labor_group(instance)

    @action(detail=True, methods=["post"], url_path="members")
    def add_members(self, request, pk=None):
        group = self.get_object()
        employee_ids = request.data.get("employee_ids", [])
        updated_count = add_gang_members(group, employee_ids)
        return Response({"status": "members_added", "count": updated_count})

    @action(detail=True, methods=["delete"], url_path="members/(?P<employee_id>[^/.]+)")
    def remove_member(self, request, pk=None, employee_id=None):
        group = self.get_object()
        remove_gang_member(group, int(employee_id))
        return Response(status=status.HTTP_204_NO_CONTENT)
