"""
Attendance views and endpoints:
- Check-in / Check-out (worked and overtime hours calculation)
- Gang & individual batch attendance marking
- Approval lock & administrative unlock
- Close-day automated absentee marking
- Attendance matrix grid and report summaries
- Holiday calendar
"""

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from attendance.models import Attendance, Holiday
from attendance.serializers import (
    ApproveAttendanceSerializer,
    AttendanceSerializer,
    BatchAttendanceSerializer,
    CheckInSerializer,
    CheckOutSerializer,
    CloseDaySerializer,
    HolidaySerializer,
    UnlockAttendanceSerializer,
)
from attendance.services import (
    approve_and_lock_attendance,
    batch_mark_attendance,
    check_in_worker,
    check_out_worker,
    close_day_attendance,
    unlock_attendance,
)
from core.exceptions import BusinessRuleError, ConflictError
from core.permissions import IsTenantUser, roles_required
from core.roles import Role
from core.views import ProjectScopedMixin, TenantViewSet
from workforce.models import Employee


class AttendanceViewSet(ProjectScopedMixin, TenantViewSet):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer
    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER, Role.SUPERVISOR, Role.ACCOUNTANT),
    ]
    filterset_fields = ["project", "date", "status", "is_locked", "employee"]
    search_fields = ["employee__full_name", "employee__employee_code"]
    ordering = ["-date", "-id"]

    def get_queryset(self):
        qs = super().get_queryset()
        qs = self.filter_project_scope(qs).select_related("employee", "project")
        qs = qs.filter(employee__deleted_at__isnull=True)

        date_from = self.request.query_params.get("date_from") or self.request.query_params.get(
            "from_date"
        )
        date_to = self.request.query_params.get("date_to") or self.request.query_params.get(
            "to_date"
        )
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)

        search = self.request.query_params.get("search")
        if search:
            from django.db.models import Q

            qs = qs.filter(
                Q(employee__full_name__icontains=search)
                | Q(employee__employee_code__icontains=search)
                | Q(employee__phone__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        from django.utils import timezone

        if self.request.user.role not in [
            Role.ORG_ADMIN,
            Role.PROJECT_MANAGER,
            Role.SUPERVISOR,
        ]:
            raise BusinessRuleError(
                "You do not have permission to mark attendance.",
                code="permission_denied",
            )

        org = self.request.user.organization
        emp = serializer.validated_data.get("employee")
        date_val = serializer.validated_data.get("date")
        if date_val and date_val > timezone.localdate():
            raise BusinessRuleError(
                "Cannot mark attendance for upcoming days. Only present and past dates are allowed.",
                code="future_attendance_not_allowed",
            )
        existing = Attendance.all_objects.filter(
            organization=org, employee=emp, date=date_val
        ).first()
        if existing:
            if existing.deleted_at is not None:
                existing.deleted_at = None
                for attr, value in serializer.validated_data.items():
                    setattr(existing, attr, value)
                existing.organization = org
                existing.save()
                serializer.instance = existing
                return
            elif existing.is_locked:
                raise ConflictError(
                    "Locked attendance records cannot be modified.", code="record_locked"
                )
            else:
                emp_name = emp.full_name if emp else "this employee"
                raise ConflictError(
                    f"Attendance has already been marked for {emp_name} on {date_val} and cannot be changed for the same day.",
                    code="attendance_already_marked",
                )
        serializer.save(organization=org)

    def perform_update(self, serializer):
        from django.utils import timezone

        if self.request.user.role not in [
            Role.ORG_ADMIN,
            Role.PROJECT_MANAGER,
            Role.SUPERVISOR,
        ]:
            raise BusinessRuleError(
                "You do not have permission to modify attendance records.",
                code="permission_denied",
            )

        if serializer.instance.is_locked:
            raise ConflictError(
                "Locked attendance records cannot be modified.", code="record_locked"
            )
        date_val = serializer.validated_data.get("date")
        if date_val and date_val > timezone.localdate():
            raise BusinessRuleError(
                "Cannot mark attendance for upcoming days. Only present and past dates are allowed.",
                code="future_attendance_not_allowed",
            )
        new_status = serializer.validated_data.get("status")
        if new_status and new_status != serializer.instance.status:
            raise ConflictError(
                "Once attendance is marked for an employee, it cannot be changed for that same day.",
                code="attendance_already_marked",
            )
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role != Role.ORG_ADMIN:
            raise BusinessRuleError(
                "Only ORG_ADMIN can delete attendance records.",
                code="permission_denied",
            )
        if instance.is_locked:
            raise ConflictError(
                "Locked attendance records cannot be deleted.", code="record_locked"
            )
        raise ConflictError(
            "Once attendance is marked for an employee, it cannot be deleted for that same day.",
            code="attendance_already_marked",
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="check-in",
        permission_classes=[roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER, Role.SUPERVISOR)],
    )
    def check_in(self, request):
        """Worker check-in on site."""
        serializer = CheckInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        record = check_in_worker(
            user=request.user,
            org=request.user.organization,
            employee_id=data["employee_id"],
            project_id=data["project_id"],
            request=request,
        )
        return Response(AttendanceSerializer(record).data, status=status.HTTP_201_CREATED)

    @action(
        detail=False,
        methods=["post"],
        url_path="check-out",
        permission_classes=[roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER, Role.SUPERVISOR)],
    )
    def check_out(self, request):
        """Worker check-out. Computes worked and overtime hours."""
        serializer = CheckOutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        record = check_out_worker(
            user=request.user,
            org=request.user.organization,
            employee_id=data["employee_id"],
            project_id=data["project_id"],
        )
        return Response(AttendanceSerializer(record).data, status=status.HTTP_200_OK)

    @action(
        detail=False,
        methods=["post"],
        url_path="batch",
        permission_classes=[roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER, Role.SUPERVISOR)],
    )
    def batch(self, request):
        """Batch mark attendance for gang members or records array."""
        serializer = BatchAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        result = batch_mark_attendance(
            user=request.user,
            org=request.user.organization,
            project_id=data.get("project_id"),
            date_val=data["date"],
            records=data.get("records"),
            group_id=data.get("group_id"),
            group_status=data.get("group_status"),
        )
        return Response(result, status=status.HTTP_200_OK)

    @action(
        detail=False,
        methods=["post"],
        url_path="approve",
        permission_classes=[roles_required(Role.PROJECT_MANAGER, Role.ORG_ADMIN)],
    )
    def approve(self, request):
        """Lock attendance records in scope."""
        serializer = ApproveAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        count = approve_and_lock_attendance(
            user=request.user,
            org=request.user.organization,
            project_id=data["project_id"],
            date_val=data.get("date"),
            date_from=data.get("date_from"),
            date_to=data.get("date_to"),
            request=request,
        )
        return Response({"locked_count": count}, status=status.HTTP_200_OK)

    @action(
        detail=False,
        methods=["post"],
        url_path="unlock",
        permission_classes=[roles_required(Role.ORG_ADMIN)],
    )
    def unlock(self, request):
        """ORG_ADMIN unlocks attendance records with mandatory reason."""
        serializer = UnlockAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        count = unlock_attendance(
            user=request.user,
            org=request.user.organization,
            project_id=data["project_id"],
            date_val=data["date"],
            reason=data["reason"],
            request=request,
        )
        return Response({"unlocked_count": count}, status=status.HTTP_200_OK)

    @action(
        detail=False,
        methods=["post"],
        url_path="close-day",
        permission_classes=[roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER, Role.SUPERVISOR)],
    )
    def close_day(self, request):
        """Automated or supervisor close-day absentee marking."""
        serializer = CloseDaySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        result = close_day_attendance(
            user=request.user,
            org=request.user.organization,
            project_id=data["project_id"],
            date_val=data["date"],
        )
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="matrix")
    def matrix(self, request):
        """Attendance matrix grid: employees as rows, dates as columns."""
        project_id = request.query_params.get("project")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        qs = self.get_queryset()
        if project_id:
            qs = qs.filter(project_id=project_id)
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)

        employees = Employee.objects.filter(
            organization=request.user.organization,
            is_active=True,
        )
        if project_id:
            employees = employees.filter(primary_project_id=project_id)

        records_map = {}
        for rec in qs:
            key = (rec.employee_id, str(rec.date))
            records_map[key] = {
                "status": rec.status,
                "ot_hours": str(rec.ot_hours),
                "is_locked": rec.is_locked,
            }

        rows = []
        for emp in employees:
            rows.append(
                {
                    "employee_id": emp.id,
                    "employee_code": emp.employee_code,
                    "full_name": emp.full_name,
                }
            )

        return Response(
            {"rows": rows, "records": {f"{k[0]}_{k[1]}": v for k, v in records_map.items()}}
        )

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Attendance summary counts and earnings for date range and filters."""
        from decimal import Decimal

        from attendance.models import AttendanceStatus

        qs = self.get_queryset()

        full_days = qs.filter(status=AttendanceStatus.PRESENT).count()
        half_days = qs.filter(status=AttendanceStatus.HALF_DAY).count()
        total_absent = qs.filter(status=AttendanceStatus.ABSENT).count()
        total_present = full_days + half_days

        total_earnings = Decimal("0.00")
        for rec in qs:
            rate = rec.employee.daily_rate or Decimal("0.00")
            if rec.status == AttendanceStatus.PRESENT:
                total_earnings += rate
            elif rec.status == AttendanceStatus.HALF_DAY:
                total_earnings += rate * Decimal("0.5")
            ot_rate = rec.employee.ot_hourly_rate or Decimal("0.00")
            total_earnings += (rec.ot_hours or Decimal("0.00")) * ot_rate

        return Response(
            {
                "total_present": total_present,
                "full_days": full_days,
                "half_days": half_days,
                "total_absent": total_absent,
                "total_earnings": float(total_earnings),
            }
        )

    @action(detail=False, methods=["get"], url_path="report")
    def report(self, request):
        """Aggregated per-employee attendance report with wage breakdown."""
        from decimal import Decimal

        from attendance.models import AttendanceStatus

        qs = self.get_queryset()

        worker_map = {}
        for rec in qs:
            emp = rec.employee
            if emp.id not in worker_map:
                trade = (emp.trade or "").upper()
                role = (
                    "KARIGAR"
                    if trade in ["MASON", "CARPENTER", "ELECTRICIAN", "PLUMBER", "WELDER"]
                    else "LABOUR"
                )
                worker_map[emp.id] = {
                    "employee_id": emp.id,
                    "employee_code": emp.employee_code,
                    "employee_name": emp.full_name,
                    "employee_role": role,
                    "daily_wage": float(emp.daily_rate or Decimal("0.00")),
                    "full_days": 0,
                    "half_days": 0,
                    "absent_days": 0,
                    "total_attendance": 0.0,
                    "total_earnings": 0.0,
                    "projects": set(),
                }

            w = worker_map[emp.id]
            if rec.project:
                w["projects"].add(rec.project.name)

            rate = float(emp.daily_rate or Decimal("0.00"))
            if rec.status == AttendanceStatus.PRESENT:
                w["full_days"] += 1
                w["total_attendance"] += 1.0
                w["total_earnings"] += rate
            elif rec.status == AttendanceStatus.HALF_DAY:
                w["half_days"] += 1
                w["total_attendance"] += 0.5
                w["total_earnings"] += rate * 0.5
            elif rec.status == AttendanceStatus.ABSENT:
                w["absent_days"] += 1

            ot_rate = float(emp.ot_hourly_rate or Decimal("0.00"))
            w["total_earnings"] += float(rec.ot_hours or Decimal("0.00")) * ot_rate

        report_rows = []
        for w in worker_map.values():
            w["projects"] = list(w["projects"])
            report_rows.append(w)

        report_rows.sort(key=lambda x: x["employee_name"])
        return Response({"rows": report_rows})


class HolidayViewSet(TenantViewSet):
    queryset = Holiday.objects.all()
    serializer_class = HolidaySerializer
    permission_classes = [IsAuthenticated, IsTenantUser]
    filterset_fields = ["date", "is_paid"]
    ordering = ["date"]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [
                IsAuthenticated(),
                IsTenantUser(),
                roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER)(),
            ]
        return [IsAuthenticated(), IsTenantUser()]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Holiday.objects.none()
        qs = Holiday.objects.filter(organization=self.request.user.organization)
        project_id = self.request.query_params.get("project")
        if project_id:
            from django.db.models import Q

            qs = qs.filter(Q(project_id=project_id) | Q(project__isnull=True))
        return qs

    def perform_create(self, serializer):
        org = self.request.user.organization
        proj = serializer.validated_data.get("project")
        hdate = serializer.validated_data.get("date")
        existing = Holiday.all_objects.filter(organization=org, project=proj, date=hdate).first()
        if existing:
            existing.deleted_at = None
            for attr, val in serializer.validated_data.items():
                setattr(existing, attr, val)
            existing.organization = org
            existing.save()
            serializer.instance = existing
            return
        serializer.save(organization=org)
