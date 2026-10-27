"""
Attendance services: GPS check-in/out, batch marking, holiday handling,
night shift sessions, close-day automation, and attendance summaries.
"""

import math
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from accounts.models import Organization
from attendance.models import (
    Attendance,
    AttendanceMethod,
    AttendanceStatus,
    Holiday,
    NightShiftSession,
    NightShiftStatus,
    ShiftType,
)
from audit.constants import AuditAction
from audit.services import log_action
from core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from core.money import q2
from projects.models import Project
from workforce.models import Employee, LaborGroup


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two GPS coordinates in meters.
    Formula:
        R = 6371000 meters
        a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)
        d = 2 * R * asin(√a)
    """
    r = 6371000.0  # Earth radius in meters
    phi1 = math.radians(float(lat1))
    phi2 = math.radians(float(lat2))
    delta_phi = math.radians(float(lat2) - float(lat1))
    delta_lambda = math.radians(float(lon2) - float(lon1))

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * (
        math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


@dataclass
class AttendanceSummary:
    """Attendance aggregate for an employee over a payroll period."""

    employee_id: int
    days_present: int
    half_days: int
    paid_holidays: int
    ot_hours: Decimal
    night_shifts: int


def get_attendance_summary(
    employee_ids: list[int],
    start,
    end,
    project=None,
) -> list[AttendanceSummary]:
    """
    Compute locked attendance summary for a list of employees between start and end dates.
    Only counts records where is_locked=True.
    """
    summaries = []
    for emp_id in employee_ids:
        qs = Attendance.objects.filter(
            employee_id=emp_id,
            date__gte=start,
            date__lte=end,
            is_locked=True,
        )
        if project:
            qs = qs.filter(project=project)

        # Days present = PRESENT rows (day + night)
        days_present = qs.filter(status=AttendanceStatus.PRESENT).count()

        # Half days
        half_days = qs.filter(status=AttendanceStatus.HALF_DAY).count()

        # Night shifts = PRESENT rows with shift_type=NIGHT
        night_shifts = qs.filter(
            status=AttendanceStatus.PRESENT, shift_type=ShiftType.NIGHT
        ).count()

        # Overtime hours sum
        ot_total = qs.aggregate(total=Sum("ot_hours"))["total"] or Decimal("0.00")

        # Paid holidays: HOLIDAY records on dates that are paid holidays
        holiday_records = qs.filter(status=AttendanceStatus.HOLIDAY)
        paid_holidays = 0
        for h_rec in holiday_records:
            is_paid = (
                Holiday.objects.filter(
                    organization=h_rec.organization,
                    date=h_rec.date,
                    is_paid=True,
                )
                .filter(Q(project=h_rec.project) | Q(project__isnull=True))
                .exists()
            )
            if is_paid:
                paid_holidays += 1

        summaries.append(
            AttendanceSummary(
                employee_id=emp_id,
                days_present=days_present,
                half_days=half_days,
                paid_holidays=paid_holidays,
                ot_hours=q2(ot_total),
                night_shifts=night_shifts,
            )
        )
    return summaries


def check_in_worker(
    user,
    org: Organization,
    employee_id: int,
    project_id: int,
    latitude: float,
    longitude: float,
    shift_type: str = ShiftType.DAY,
    request=None,
) -> Attendance:
    """
    UC-11: GPS check-in worker on site.
    Validates geofence. Distance <= radius accepted; otherwise logs
    ATTENDANCE_OFFSITE_ATTEMPT and raises outside_geofence error.
    """
    try:
        project = Project.objects.get(organization=org, id=project_id)
    except Project.DoesNotExist:
        raise NotFoundError("Project not found.")

    try:
        employee = Employee.objects.get(organization=org, id=employee_id, is_active=True)
    except Employee.DoesNotExist:
        raise NotFoundError("Active employee not found in this organization.")

    # Geofence check
    if project.geofence_lat is None or project.geofence_lng is None:
        raise BusinessRuleError(
            "Geofence is not configured for this project.", code="geofence_not_configured"
        )

    distance = haversine_m(
        latitude,
        longitude,
        float(project.geofence_lat),
        float(project.geofence_lng),
    )

    if distance > project.geofence_radius_m:
        log_action(
            user=user,
            action=AuditAction.ATTENDANCE_OFFSITE_ATTEMPT,
            obj=project,
            changes={
                "employee_id": employee.id,
                "distance_m": round(distance, 2),
                "radius_m": project.geofence_radius_m,
                "latitude": latitude,
                "longitude": longitude,
            },
            request=request,
            organization=org,
        )
        raise BusinessRuleError(
            f"Outside project geofence boundary (Distance: {round(distance, 1)}m, Allowed: {project.geofence_radius_m}m).",
            code="outside_geofence",
            details={"distance_m": round(distance, 2), "radius_m": project.geofence_radius_m},
        )

    today = timezone.localdate()
    # Duplicate check for same worker, date, and shift
    existing = Attendance.all_objects.filter(
        organization=org, employee=employee, date=today, shift_type=shift_type
    ).first()
    if existing and existing.deleted_at is None:
        raise ConflictError(
            f"Worker '{employee.employee_code}' is already checked in for shift {shift_type} today.",
            code="duplicate_attendance",
        )

    now = timezone.now()
    marked_user = user or org.users.first()
    if existing:
        existing.deleted_at = None
        existing.project = project
        existing.status = AttendanceStatus.PRESENT
        existing.check_in_time = now
        existing.check_out_time = None
        existing.latitude = Decimal(str(latitude))
        existing.longitude = Decimal(str(longitude))
        existing.distance_m = q2(Decimal(str(distance)))
        existing.is_geofence_verified = True
        existing.method = AttendanceMethod.GPS
        existing.marked_by = marked_user
        existing.save()
        return existing

    return Attendance.objects.create(
        organization=org,
        employee=employee,
        project=project,
        date=today,
        shift_type=shift_type,
        status=AttendanceStatus.PRESENT,
        check_in_time=now,
        latitude=Decimal(str(latitude)),
        longitude=Decimal(str(longitude)),
        distance_m=q2(Decimal(str(distance))),
        is_geofence_verified=True,
        method=AttendanceMethod.GPS,
        marked_by=marked_user,
    )


def check_out_worker(
    user,
    org: Organization,
    employee_id: int,
    project_id: int,
    latitude: float | None = None,
    longitude: float | None = None,
    shift_type: str = ShiftType.DAY,
) -> Attendance:
    """
    Check-out worker and calculate worked hours and overtime.
    """
    today = timezone.localdate()
    try:
        record = Attendance.objects.get(
            organization=org,
            employee_id=employee_id,
            project_id=project_id,
            date=today,
            shift_type=shift_type,
        )
    except Attendance.DoesNotExist:
        raise NotFoundError("Check-in record not found for today.")

    if record.is_locked:
        raise ConflictError("Cannot modify locked attendance record.", code="record_locked")

    if record.check_out_time is not None:
        raise BusinessRuleError("Worker has already checked out.", code="already_checked_out")

    now = timezone.now()
    record.check_out_time = now

    # Calculate worked hours
    if record.check_in_time:
        diff_hours = (now - record.check_in_time).total_seconds() / 3600.0
        worked_hours = q2(Decimal(str(diff_hours)))
        record.worked_hours = worked_hours

        # Overtime calculation based on org settings
        half_day_limit = getattr(org, "half_day_hours", Decimal("4.00"))
        ot_limit = getattr(org, "overtime_after_hours", Decimal("8.00"))

        if worked_hours < half_day_limit:
            record.status = AttendanceStatus.HALF_DAY
        else:
            record.status = AttendanceStatus.PRESENT

        record.ot_hours = max(Decimal("0.00"), q2(worked_hours - ot_limit))

    record.save(
        update_fields=["check_out_time", "worked_hours", "ot_hours", "status", "updated_at"]
    )
    return record


def batch_mark_attendance(
    user,
    org: Organization,
    project_id: int | None = None,
    date_val: date | None = None,
    shift_type: str = ShiftType.DAY,
    records: list[dict] | None = None,
    group_id: int | None = None,
    group_status: str | None = None,
) -> dict:
    """
    UC-12: Batch mark attendance for labor gang members or explicit employee list.
    Upserts unlocked rows; skips locked rows.
    """
    today = timezone.localdate()
    parsed_date = date_val if isinstance(date_val, date) else date.fromisoformat(str(date_val))
    if parsed_date > today:
        raise BusinessRuleError(
            "Cannot mark attendance for upcoming days. Attendance can only be recorded for today or past dates.",
            code="future_attendance_not_allowed",
        )

    default_project = None
    if project_id:
        try:
            default_project = Project.objects.get(organization=org, id=project_id)
        except Project.DoesNotExist:
            raise NotFoundError("Project not found.")

    prepared_entries = []

    # 1. Gang batch marking
    if group_id:
        try:
            group = LaborGroup.objects.get(organization=org, id=group_id, is_active=True)
        except LaborGroup.DoesNotExist:
            raise NotFoundError("Active labor group not found.")

        members = group.members.filter(is_active=True)
        target_status = group_status or AttendanceStatus.PRESENT
        for member in members:
            prepared_entries.append(
                {
                    "employee_id": member.id,
                    "project_id": project_id or (member.primary_project_id or group.project_id),
                    "shift_type": shift_type,
                    "status": target_status,
                    "ot_hours": Decimal("0.00"),
                    "remarks": f"Gang batch: {group.name}",
                }
            )

    # 2. Explicit records list
    if records:
        for rec in records:
            prepared_entries.append(
                {
                    "employee_id": rec["employee_id"],
                    "project_id": rec.get("project_id") or project_id,
                    "shift_type": rec.get("shift_type") or shift_type,
                    "status": rec.get("status", AttendanceStatus.PRESENT),
                    "ot_hours": q2(Decimal(str(rec.get("ot_hours", "0.00")))),
                    "remarks": rec.get("remarks", ""),
                }
            )

    created_count = 0
    updated_count = 0
    skipped_count = 0

    with transaction.atomic():
        marked_user = user or org.users.first()
        for item in prepared_entries:
            emp_id = item["employee_id"]
            item_shift = item.get("shift_type") or ShiftType.DAY
            item_proj = None

            emp = Employee.objects.filter(organization=org, id=emp_id).first()
            if not emp:
                continue

            if item.get("project_id"):
                item_proj = Project.objects.filter(organization=org, id=item["project_id"]).first()
            if not item_proj and default_project:
                item_proj = default_project
            if not item_proj:
                if emp.primary_project:
                    item_proj = emp.primary_project

            if not item_proj:
                emp_name = emp.full_name if emp else f"ID {emp_id}"
                raise BusinessRuleError(
                    f"Project allocation is required for worker '{emp_name}'. Attendance cannot be marked without an allocated project site.",
                    code="project_allocation_required",
                )

            # Strict check: Employee MUST be registered/assigned to this project site!
            is_registered = (
                (emp.primary_project_id == item_proj.id)
                or emp.assigned_projects.filter(id=item_proj.id).exists()
            )
            if not is_registered:
                raise BusinessRuleError(
                    f"Worker '{emp.full_name}' is not registered for work at '{item_proj.name}'. Attendance can only be marked at their assigned project sites.",
                    code="worker_not_assigned_to_project",
                )

            existing = Attendance.all_objects.filter(
                organization=org,
                employee_id=emp_id,
                date=parsed_date,
                shift_type=item_shift,
            ).first()

            if existing:
                if existing.deleted_at is None:
                    # Once attendance is marked for any employee, it cannot be changed for that same day.
                    skipped_count += 1
                    continue
                else:
                    existing.deleted_at = None
                    existing.status = item["status"]
                    existing.ot_hours = item["ot_hours"]
                    existing.remarks = item["remarks"]
                    existing.method = AttendanceMethod.MANUAL
                    existing.marked_by = marked_user
                    existing.project = item_proj
                    existing.save()
                    created_count += 1
            else:
                Attendance.objects.create(
                    organization=org,
                    employee_id=emp_id,
                    project=item_proj,
                    date=date_val,
                    shift_type=item_shift,
                    status=item["status"],
                    ot_hours=item["ot_hours"],
                    remarks=item["remarks"],
                    method=AttendanceMethod.MANUAL,
                    marked_by=marked_user,
                )
                created_count += 1

    return {"created": created_count, "updated": updated_count, "skipped": skipped_count}


def approve_and_lock_attendance(
    user,
    org: Organization,
    project_id: int,
    date_val: date | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    request=None,
) -> int:
    """
    UC-15: PM / ORG_ADMIN approve and lock attendance records. Audited.
    """
    qs = Attendance.objects.filter(organization=org, project_id=project_id, is_locked=False)
    if date_val:
        qs = qs.filter(date=date_val)
    if date_from:
        qs = qs.filter(date__gte=date_from)
    if date_to:
        qs = qs.filter(date__lte=date_to)

    now = timezone.now()
    count = qs.update(is_locked=True, locked_at=now, locked_by=user)

    log_action(
        user=user,
        action=AuditAction.ATTENDANCE_LOCKED,
        changes={
            "project_id": project_id,
            "locked_count": count,
            "date": str(date_val or f"{date_from}..{date_to}"),
        },
        request=request,
        organization=org,
    )
    return count


def unlock_attendance(
    user,
    org: Organization,
    project_id: int,
    date_val: date,
    reason: str,
    request=None,
) -> int:
    """
    UC-15: ORG_ADMIN unlocks attendance with mandatory reason. Audited.
    """
    if not reason or not reason.strip():
        raise BusinessRuleError(
            "A mandatory reason is required to unlock attendance.", code="reason_required"
        )

    qs = Attendance.objects.filter(
        organization=org, project_id=project_id, date=date_val, is_locked=True
    )
    count = qs.update(is_locked=False, locked_at=None, locked_by=None)

    log_action(
        user=user,
        action=AuditAction.ATTENDANCE_UNLOCKED,
        changes={
            "project_id": project_id,
            "date": str(date_val),
            "unlocked_count": count,
            "reason": reason,
        },
        request=request,
        organization=org,
    )
    return count


def close_day_attendance(
    user,
    org: Organization,
    project_id: int,
    date_val: date,
) -> dict:
    """
    For active workers of the project with no DAY record:
    creates HOLIDAY if a holiday applies, else ABSENT.
    """
    try:
        project = Project.objects.get(organization=org, id=project_id)
    except Project.DoesNotExist:
        raise NotFoundError("Project not found.")

    active_workers = Employee.objects.filter(
        organization=org,
        primary_project=project,
        is_active=True,
    )

    holiday_applies = (
        Holiday.objects.filter(
            organization=org,
            date=date_val,
        )
        .filter(Q(project=project) | Q(project__isnull=True))
        .first()
    )

    closed_count = 0
    holiday_count = 0
    absent_count = 0
    marked_user = user or org.users.first()

    with transaction.atomic():
        for worker in active_workers:
            existing = Attendance.all_objects.filter(
                organization=org,
                employee=worker,
                date=date_val,
                shift_type=ShiftType.DAY,
            ).first()

            status = AttendanceStatus.HOLIDAY if holiday_applies else AttendanceStatus.ABSENT
            if not existing:
                Attendance.objects.create(
                    organization=org,
                    employee=worker,
                    project=project,
                    date=date_val,
                    shift_type=ShiftType.DAY,
                    status=status,
                    method=AttendanceMethod.MANUAL,
                    marked_by=marked_user,
                    remarks="Auto close-day mark",
                )
                closed_count += 1
                if holiday_applies:
                    holiday_count += 1
                else:
                    absent_count += 1
            elif existing.deleted_at is not None:
                existing.deleted_at = None
                existing.project = project
                existing.status = status
                existing.method = AttendanceMethod.MANUAL
                existing.marked_by = marked_user
                existing.remarks = "Auto close-day mark"
                existing.save()
                closed_count += 1
                if holiday_applies:
                    holiday_count += 1
                else:
                    absent_count += 1

    return {"closed_records": closed_count, "holidays": holiday_count, "absents": absent_count}


def create_night_shift_session(
    user,
    org: Organization,
    project_id: int,
    shift_date: date,
    employee_ids: list[int],
    safety_checklist_signed: bool,
    checklist_notes: str = "",
) -> NightShiftSession:
    """
    UC-14: Run a night shift. Mandatory safety checklist signed.
    Creates NightShiftSession and NIGHT attendance rows.
    """
    today = timezone.localdate()
    parsed_date = shift_date if isinstance(shift_date, date) else date.fromisoformat(str(shift_date))
    if parsed_date > today:
        raise BusinessRuleError(
            "Cannot create night shift session for upcoming days. Attendance can only be recorded for today or past dates.",
            code="future_attendance_not_allowed",
        )

    if not safety_checklist_signed:
        raise BusinessRuleError(
            "The supervisor must sign the safety checklist before initiating a night shift.",
            code="checklist_required",
        )

    try:
        project = Project.objects.get(organization=org, id=project_id)
    except Project.DoesNotExist:
        raise NotFoundError("Project not found.")

    marked_user = user or org.users.first()

    with transaction.atomic():
        session = NightShiftSession.objects.create(
            organization=org,
            project=project,
            shift_date=shift_date,
            supervisor=marked_user,
            safety_checklist_signed=True,
            checklist_notes=checklist_notes,
            status=NightShiftStatus.IN_PROGRESS,
        )

        for emp_id in employee_ids:
            existing = Attendance.all_objects.filter(
                organization=org,
                employee_id=emp_id,
                date=shift_date,
                shift_type=ShiftType.NIGHT,
            ).first()
            if existing:
                existing.deleted_at = None
                existing.project = project
                existing.status = AttendanceStatus.PRESENT
                existing.method = AttendanceMethod.MANUAL
                existing.night_shift = session
                existing.marked_by = marked_user
                existing.save()
            else:
                Attendance.objects.create(
                    organization=org,
                    employee_id=emp_id,
                    project=project,
                    date=shift_date,
                    shift_type=ShiftType.NIGHT,
                    status=AttendanceStatus.PRESENT,
                    method=AttendanceMethod.MANUAL,
                    night_shift=session,
                    marked_by=marked_user,
                )

    return session


def complete_night_shift_session(
    user,
    session: NightShiftSession,
    end_time: datetime | None = None,
    work_completed: str = "",
) -> NightShiftSession:
    """
    Complete night shift and record work summary.
    """
    session.status = NightShiftStatus.COMPLETED
    session.end_time = end_time or timezone.now()
    session.work_completed = work_completed
    session.save(update_fields=["status", "end_time", "work_completed", "updated_at"])
    return session


def approve_night_shift_session(
    user,
    session: NightShiftSession,
    request=None,
) -> NightShiftSession:
    """
    Approve night shift session and lock roster attendance rows.
    """
    now = timezone.now()
    session.status = NightShiftStatus.APPROVED
    session.approved_by = user
    session.approved_at = now
    session.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])

    # Lock roster attendance rows
    session.roster_attendance.update(is_locked=True, locked_at=now, locked_by=user)

    log_action(
        user=user,
        action=AuditAction.NIGHT_SHIFT_APPROVED,
        obj=session,
        changes={"status": NightShiftStatus.APPROVED, "session_id": session.id},
        request=request,
        organization=session.organization,
    )
    return session
