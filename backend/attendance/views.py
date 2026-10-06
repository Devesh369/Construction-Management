"""
Attendance views and endpoints:
- Check-in (GPS geofence) / Check-out (OT hours calculation)
- Gang & individual batch attendance marking
- Approval lock & administrative unlock
- Close-day automated absentee marking
- Attendance matrix grid
- Night shift sessions with supervisor checklists
- Holiday calendar
"""

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from attendance.models import Attendance, Holiday, NightShiftSession
from attendance.serializers import (
    ApproveAttendanceSerializer,
    AttendanceSerializer,
    BatchAttendanceSerializer,
    CheckInSerializer,
    CheckOutSerializer,
    CloseDaySerializer,
    HolidaySerializer,
    NightShiftCompleteSerializer,
    NightShiftCreateSerializer,
    NightShiftSessionSerializer,
    UnlockAttendanceSerializer,
)
from attendance.services import (
    approve_and_lock_attendance,
    approve_night_shift_session,
    batch_mark_attendance,
    check_in_worker,
    check_out_worker,
    close_day_attendance,
    complete_night_shift_session,
    create_night_shift_session,
    unlock_attendance,
)
from core.exceptions import ConflictError
from core.permissions import IsTenantUser, roles_required
from core.roles import Role
from core.views import ProjectScopedMixin, TenantViewSet
from workforce.models import Employee


class AttendanceViewSet(ProjectScopedMixin, TenantViewSet):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated, IsTenantUser]
    filterset_fields = ["project", "date", "status", "is_locked", "employee"]
    search_fields = ["employee__full_name", "employee__employee_code"]
    ordering = ["-date", "-id"]

    def get_queryset(self):
        qs = super().get_queryset()
        return self.filter_project_scope(qs).select_related("employee", "project")

    def perform_update(self, serializer):
        if serializer.instance.is_locked:
            raise ConflictError(
                "Locked attendance records cannot be modified.", code="record_locked"
            )
        serializer.save()

    def perform_destroy(self, instance):
        if instance.is_locked:
            raise ConflictError(
                "Locked attendance records cannot be deleted.", code="record_locked"
            )
        super().perform_destroy(instance)

    @action(detail=False, methods=["post"], url_path="check-in")
    def check_in(self, request):
        """UC-11: Worker GPS check-in on site with geofence verification."""
        serializer = CheckInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        record = check_in_worker(
            user=request.user,
            org=request.user.organization,
            employee_id=data["employee_id"],
            project_id=data["project_id"],
            latitude=data["latitude"],
            longitude=data["longitude"],
            shift_type=data.get("shift_type", "DAY"),
            request=request,
        )
        return Response(AttendanceSerializer(record).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="check-out")
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
            latitude=data.get("latitude"),
            longitude=data.get("longitude"),
            shift_type=data.get("shift_type", "DAY"),
        )
        return Response(AttendanceSerializer(record).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="batch")
    def batch(self, request):
        """UC-12: Batch mark attendance for gang members or records array."""
        serializer = BatchAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        result = batch_mark_attendance(
            user=request.user,
            org=request.user.organization,
            project_id=data["project_id"],
            date_val=data["date"],
            shift_type=data.get("shift_type", "DAY"),
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
        """UC-15: Lock attendance records in scope."""
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
        """UC-15: ORG_ADMIN unlocks attendance records with mandatory reason."""
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

    @action(detail=False, methods=["post"], url_path="close-day")
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


class HolidayViewSet(TenantViewSet):
    queryset = Holiday.objects.all()
    serializer_class = HolidaySerializer
    permission_classes = [IsAuthenticated, IsTenantUser]
    filterset_fields = ["date", "is_paid"]
    ordering = ["date"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Holiday.objects.none()
        qs = Holiday.objects.filter(organization=self.request.user.organization)
        project_id = self.request.query_params.get("project")
        if project_id:
            from django.db.models import Q

            qs = qs.filter(Q(project_id=project_id) | Q(project__isnull=True))
        return qs


class NightShiftSessionViewSet(ProjectScopedMixin, TenantViewSet):
    queryset = NightShiftSession.objects.all()
    serializer_class = NightShiftSessionSerializer
    permission_classes = [IsAuthenticated, IsTenantUser]
    filterset_fields = ["project", "shift_date", "status"]
    ordering = ["-shift_date", "-id"]

    def get_queryset(self):
        qs = super().get_queryset()
        return self.filter_project_scope(qs).select_related("project", "supervisor")

    def create(self, request, *args, **kwargs):
        """UC-14: Start a night shift session with mandatory safety checklist."""
        serializer = NightShiftCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        session = create_night_shift_session(
            user=request.user,
            org=request.user.organization,
            project_id=data["project_id"],
            shift_date=data["shift_date"],
            employee_ids=data["employee_ids"],
            safety_checklist_signed=data["safety_checklist_signed"],
            checklist_notes=data.get("checklist_notes", ""),
        )
        return Response(NightShiftSessionSerializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch"], url_path="complete")
    def complete(self, request, pk=None):
        """Complete night shift session and record work summary."""
        session = self.get_object()
        serializer = NightShiftCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        completed = complete_night_shift_session(
            user=request.user,
            session=session,
            end_time=data.get("end_time"),
            work_completed=data.get("work_completed", ""),
        )
        return Response(NightShiftSessionSerializer(completed).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="approve",
        permission_classes=[roles_required(Role.PROJECT_MANAGER, Role.ORG_ADMIN)],
    )
    def approve(self, request, pk=None):
        """Approve night shift session and lock roster attendance rows."""
        session = self.get_object()
        approved = approve_night_shift_session(user=request.user, session=session, request=request)
        return Response(NightShiftSessionSerializer(approved).data)
