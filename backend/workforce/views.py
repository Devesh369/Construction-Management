"""
Workforce views: Employee directory and LaborGroup management.
"""

from core.permissions import IsTenantUser, roles_required
from core.roles import Role
from core.views import TenantViewSet
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

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
    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER, Role.SUPERVISOR, Role.ACCOUNTANT),
    ]
    filterset_fields = ["trade", "primary_project", "group", "employment_type", "is_active"]
    search_fields = ["full_name", "employee_code", "phone"]

    def get_permissions(self):
        if self.action in ["list", "retrieve", "lookup"]:
            return [
                IsAuthenticated(),
                IsTenantUser(),
                roles_required(
                    Role.ORG_ADMIN,
                    Role.PROJECT_MANAGER,
                    Role.SUPERVISOR,
                    Role.ACCOUNTANT,
                    Role.SITE_MANAGER,
                    Role.SITE_ENGINEER,
                    Role.EMPLOYEE,
                    "employee/labour",
                )(),
            ]
        return [
            IsAuthenticated(),
            IsTenantUser(),
            roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER, Role.SUPERVISOR)(),
        ]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Employee.objects.none()
        qs = (
            Employee.objects.filter(
                organization=self.request.user.organization,
                deleted_at__isnull=True,
            )
            .select_related("primary_project", "group")
            .prefetch_related("assigned_projects")
        )
        user = self.request.user
        if user.is_authenticated and user.role in [Role.EMPLOYEE, "employee/labour", "EMPLOYEE", "LABOUR"]:
            from django.db.models import Q
            qs = qs.filter(
                Q(email__iexact=user.email) |
                (Q(phone=user.phone) & ~Q(phone="")) |
                Q(full_name__iexact=user.name)
            )
        return qs

    def create(self, request, *args, **kwargs):
        if request.user.role not in [
            Role.ORG_ADMIN,
            Role.PROJECT_MANAGER,
            Role.SITE_MANAGER,
            Role.SUPERVISOR,
        ]:
            return Response(
                {
                    "error": {
                        "code": "permission_denied",
                        "message": "You do not have permission to register worker records.",
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )
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
        if request.user.role not in [
            Role.ORG_ADMIN,
            Role.PROJECT_MANAGER,
            Role.ACCOUNTANT,
            Role.SUPERVISOR,
        ]:
            return Response(
                {
                    "error": {
                        "code": "permission_denied",
                        "message": "You do not have permission to modify worker records.",
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )
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

    def perform_destroy(self, instance):
        from django.utils import timezone

        now = timezone.now()
        instance.deleted_at = now
        instance.save(update_fields=["deleted_at", "updated_at"])
        from attendance.models import Attendance

        Attendance.objects.filter(employee=instance).update(deleted_at=now, updated_at=now)

    def destroy(self, request, *args, **kwargs):
        if request.user.role != Role.ORG_ADMIN:
            return Response(
                {
                    "error": {
                        "code": "permission_denied",
                        "message": "Only Organization Administrators can delete worker profiles.",
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    @action(
        detail=True,
        methods=["post"],
        url_path="assign-project",
        permission_classes=[roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER, Role.SUPERVISOR)],
    )
    def assign_project(self, request, pk=None):
        from workforce.services import assign_project_to_employee

        employee = self.get_object()
        project_id = request.data.get("project_id")
        if not project_id:
            return Response({"error": "project_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        updated = assign_project_to_employee(employee, int(project_id))
        return Response(self.get_serializer(updated).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="unassign-project",
        permission_classes=[roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER, Role.SUPERVISOR)],
    )
    def unassign_project(self, request, pk=None):
        from workforce.services import unassign_project_from_employee

        employee = self.get_object()
        project_id = request.data.get("project_id")
        if not project_id:
            return Response({"error": "project_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        updated = unassign_project_from_employee(employee, int(project_id))
        return Response(self.get_serializer(updated).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="pay",
        permission_classes=[roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER, Role.ACCOUNTANT)],
    )
    def pay(self, request, pk=None):
        from decimal import Decimal

        from workforce.services import get_employee_financials, record_employee_payment

        employee = self.get_object()
        from attendance.models import Attendance, AttendanceStatus

        has_attendance = Attendance.objects.filter(
            employee=employee,
            status__in=[
                AttendanceStatus.PRESENT,
                AttendanceStatus.HALF_DAY,
                AttendanceStatus.HOLIDAY,
            ],
            deleted_at__isnull=True,
        ).exists()
        if not has_attendance:
            return Response(
                {
                    "error": "Cannot pay wages to a newly added employee without marked attendance. Attendance must be marked first."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        amount_raw = request.data.get("amount")
        if not amount_raw or Decimal(str(amount_raw)) <= Decimal("0.00"):
            return Response(
                {"error": "Valid positive amount is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        payment_mode = request.data.get("payment_mode", "CASH")
        notes = request.data.get("notes", "")
        voucher = record_employee_payment(
            employee=employee,
            amount=Decimal(str(amount_raw)),
            payment_mode=payment_mode,
            notes=notes,
            user=request.user,
            request=request,
        )
        return Response(
            {
                "status": "PAID",
                "voucher_id": voucher.id,
                "voucher_number": voucher.voucher_number,
                "net_pay": str(voucher.net_pay),
                "financials": get_employee_financials(employee),
            },
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="upad",
        permission_classes=[
            roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER, Role.ACCOUNTANT, Role.SUPERVISOR)
        ],
    )
    def upad(self, request, pk=None):
        from decimal import Decimal

        from workforce.services import get_employee_financials, record_employee_upad

        employee = self.get_object()
        amount_raw = request.data.get("amount")
        if not amount_raw or Decimal(str(amount_raw)) <= Decimal("0.00"):
            return Response(
                {"error": "Valid positive amount is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        advance_date = request.data.get("advance_date")
        reason = request.data.get("reason", "")
        payment_mode = request.data.get("payment_mode", "CASH")
        adv = record_employee_upad(
            employee=employee,
            amount=Decimal(str(amount_raw)),
            advance_date=advance_date,
            reason=reason,
            payment_mode=payment_mode,
            user=request.user,
            request=request,
        )
        return Response(
            {
                "status": "RECORDED",
                "advance_id": adv.id,
                "amount": str(adv.amount),
                "financials": get_employee_financials(employee),
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"], url_path="payment-history")
    def payment_history(self, request, pk=None):
        from workforce.services import get_employee_payment_history

        employee = self.get_object()
        history = get_employee_payment_history(employee)
        return Response(history)

    @action(detail=True, methods=["get"], url_path="financials")
    def financials(self, request, pk=None):
        from workforce.services import get_employee_financials

        employee = self.get_object()
        return Response(get_employee_financials(employee))


class LaborGroupViewSet(TenantViewSet):
    queryset = LaborGroup.objects.all()
    serializer_class = LaborGroupSerializer
    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(
            Role.ORG_ADMIN,
            Role.PROJECT_MANAGER,
            Role.SUPERVISOR,
            Role.ACCOUNTANT,
            Role.SITE_MANAGER,
            Role.SITE_ENGINEER,
            Role.EMPLOYEE,
            "employee/labour",
        ),
    ]

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [
                IsAuthenticated(),
                IsTenantUser(),
                roles_required(
                    Role.ORG_ADMIN,
                    Role.PROJECT_MANAGER,
                    Role.SUPERVISOR,
                    Role.ACCOUNTANT,
                    Role.SITE_MANAGER,
                    Role.SITE_ENGINEER,
                    Role.EMPLOYEE,
                    "employee/labour",
                )(),
            ]
        return [
            IsAuthenticated(),
            IsTenantUser(),
            roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER, Role.SUPERVISOR)(),
        ]
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
