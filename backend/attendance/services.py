"""
Attendance services: check-in/out, batch marking, holiday handling,
close-day automation, and attendance summaries.
Simplified without GPS or shift logic.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from accounts.models import Organization
from audit.constants import AuditAction
from audit.services import log_action
from core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from core.money import q2
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from projects.models import Project
from workforce.models import Employee, LaborGroup

from attendance.models import (
    Attendance,
    AttendanceStatus,
    Holiday,
)


@dataclass
class AttendanceSummary:
    """Attendance aggregate for an employee over a payroll period."""

    employee_id: int
    days_present: int
    half_days: int
    paid_holidays: int
    ot_hours: Decimal


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

        # Days present = PRESENT rows
        days_present = qs.filter(status=AttendanceStatus.PRESENT).count()

        # Half days
        half_days = qs.filter(status=AttendanceStatus.HALF_DAY).count()

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
            )
        )
    return summaries


def check_in_worker(
    user,
    org: Organization,
    employee_id: int,
    project_id: int,
    request=None,
) -> Attendance:
    """
    Worker check-in on project site.
    """
    try:
        project = Project.objects.get(organization=org, id=project_id)
    except Project.DoesNotExist:
        raise NotFoundError("Project not found.")

    try:
        employee = Employee.objects.get(organization=org, id=employee_id, is_active=True)
    except Employee.DoesNotExist:
        raise NotFoundError("Active employee not found in this organization.")

    today = timezone.localdate()
    existing = Attendance.all_objects.filter(
        organization=org, employee=employee, date=today
    ).first()
    if existing and existing.deleted_at is None:
        raise ConflictError(
            f"Worker '{employee.employee_code}' is already checked in for today.",
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
        existing.marked_by = marked_user
        existing.save()
        return existing

    return Attendance.objects.create(
        organization=org,
        employee=employee,
        project=project,
        date=today,
        status=AttendanceStatus.PRESENT,
        check_in_time=now,
        marked_by=marked_user,
    )


def check_out_worker(
    user,
    org: Organization,
    employee_id: int,
    project_id: int,
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
    records: list[dict] | None = None,
    group_id: int | None = None,
    group_status: str | None = None,
    **kwargs,
) -> dict:
    """
    Batch mark attendance for labor gang members or explicit employee list.
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

            # Check project site assignment
            is_registered = (
                emp.primary_project_id == item_proj.id
            ) or emp.assigned_projects.filter(id=item_proj.id).exists()
            if not is_registered:
                raise BusinessRuleError(
                    f"Worker '{emp.full_name}' is not registered for work at '{item_proj.name}'. Attendance can only be marked at their assigned project sites.",
                    code="worker_not_assigned_to_project",
                )

            existing = Attendance.all_objects.filter(
                organization=org,
                employee_id=emp_id,
                date=parsed_date,
            ).first()

            if existing:
                if existing.is_locked:
                    # Once approved and locked, attendance cannot be modified
                    skipped_count += 1
                    continue
                else:
                    existing.deleted_at = None
                    existing.status = item["status"]
                    existing.ot_hours = item["ot_hours"]
                    existing.remarks = item["remarks"]
                    existing.marked_by = marked_user
                    existing.project = item_proj
                    existing.save()
                    updated_count += 1
            else:
                Attendance.objects.create(
                    organization=org,
                    employee_id=emp_id,
                    project=item_proj,
                    date=date_val,
                    status=item["status"],
                    ot_hours=item["ot_hours"],
                    remarks=item["remarks"],
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
    PM / ORG_ADMIN approve and lock attendance records. Audited.
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
    ORG_ADMIN unlocks attendance with mandatory reason. Audited.
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
    For active workers of the project with no record:
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
            ).first()

            status = AttendanceStatus.HOLIDAY if holiday_applies else AttendanceStatus.ABSENT
            if not existing:
                Attendance.objects.create(
                    organization=org,
                    employee=worker,
                    project=project,
                    date=date_val,
                    status=status,
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
                existing.marked_by = marked_user
                existing.remarks = "Auto close-day mark"
                existing.save()
                closed_count += 1
                if holiday_applies:
                    holiday_count += 1
                else:
                    absent_count += 1

    return {"closed_records": closed_count, "holidays": holiday_count, "absents": absent_count}
