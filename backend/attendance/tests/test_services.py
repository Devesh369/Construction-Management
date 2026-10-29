from datetime import date, timedelta
from decimal import Decimal

import pytest
from accounts.services import accept_invitation, create_organization
from audit.constants import AuditAction
from audit.models import AuditLog
from core.exceptions import BusinessRuleError, ConflictError
from django.utils import timezone
from projects.services import create_project
from workforce.services import add_gang_members, create_employee, create_labor_group

from attendance.models import (
    Attendance,
    AttendanceStatus,
    Holiday,
)
from attendance.services import (
    approve_and_lock_attendance,
    batch_mark_attendance,
    check_in_worker,
    check_out_worker,
    close_day_attendance,
    get_attendance_summary,
    unlock_attendance,
)


@pytest.mark.django_db
class TestAttendanceServices:
    def setup_method(self):
        self.org, self.invite, self.token = create_organization("Attendance Org", "admin@att.test")
        self.admin, _ = accept_invitation(self.token, "AdminPass123#", "Admin Att")
        self.project = create_project(
            self.org,
            user=self.admin,
            data={
                "name": "Site Alpha",
                "code": "ALP-01",
            },
        )
        self.worker1 = create_employee(
            self.org,
            data={
                "full_name": "Ramesh Kumar",
                "trade": "MASON",
                "employment_type": "DAILY_WAGE",
                "daily_rate": Decimal("800.00"),
                "primary_project": self.project,
            },
            user=self.admin,
        )
        self.worker2 = create_employee(
            self.org,
            data={
                "full_name": "Suresh Yadav",
                "trade": "CARPENTER",
                "employment_type": "DAILY_WAGE",
                "daily_rate": Decimal("850.00"),
                "primary_project": self.project,
            },
            user=self.admin,
        )

    def test_check_in_worker_success(self):
        """Worker check-in on project site succeeds."""
        rec = check_in_worker(
            user=self.admin,
            org=self.org,
            employee_id=self.worker1.id,
            project_id=self.project.id,
        )
        assert rec.status == AttendanceStatus.PRESENT
        assert rec.check_in_time is not None

    def test_duplicate_check_in_rejected(self):
        """Checking in twice for the same date raises ConflictError."""
        check_in_worker(
            user=self.admin,
            org=self.org,
            employee_id=self.worker1.id,
            project_id=self.project.id,
        )
        with pytest.raises(ConflictError, match="already checked in"):
            check_in_worker(
                user=self.admin,
                org=self.org,
                employee_id=self.worker1.id,
                project_id=self.project.id,
            )

    def test_check_out_and_overtime_calculation(self):
        """Check-out sets check-out time, worked hours, and overtime hours."""
        rec = check_in_worker(
            user=self.admin,
            org=self.org,
            employee_id=self.worker1.id,
            project_id=self.project.id,
        )
        # Manually backdate check-in time by 9.5 hours
        rec.check_in_time = timezone.now() - timedelta(hours=9, minutes=30)
        rec.save(update_fields=["check_in_time"])

        checked_out = check_out_worker(
            user=self.admin,
            org=self.org,
            employee_id=self.worker1.id,
            project_id=self.project.id,
        )
        assert checked_out.check_out_time is not None
        assert checked_out.worked_hours >= Decimal("9.40")
        assert checked_out.ot_hours >= Decimal("1.40")
        assert checked_out.status == AttendanceStatus.PRESENT

    def test_check_out_before_check_in_raises_not_found(self):
        """Checking out without a check-in record raises NotFoundError."""
        from core.exceptions import NotFoundError

        with pytest.raises(NotFoundError):
            check_out_worker(
                user=self.admin,
                org=self.org,
                employee_id=self.worker2.id,
                project_id=self.project.id,
            )

    def test_batch_mark_labor_gang(self):
        """Batch marking for a labor group creates attendance for all group members."""
        group = create_labor_group(
            self.org,
            project=self.project,
            name="Alpha Gang",
            leader=self.worker1,
        )
        add_gang_members(group, [self.worker1.id, self.worker2.id])
        target_date = date(2026, 3, 10)
        res = batch_mark_attendance(
            user=self.admin,
            org=self.org,
            project_id=self.project.id,
            date_val=target_date,
            group_id=group.id,
            group_status=AttendanceStatus.PRESENT,
        )
        assert res["created"] == 2
        records = Attendance.objects.filter(
            organization=self.org, project=self.project, date=target_date
        )
        assert records.count() == 2

    def test_batch_mark_explicit_records_list(self):
        """Batch marking with explicit records list."""
        target_date = date(2026, 3, 11)
        records_data = [
            {
                "employee_id": self.worker1.id,
                "status": AttendanceStatus.PRESENT,
                "ot_hours": "1.50",
            },
            {
                "employee_id": self.worker2.id,
                "status": AttendanceStatus.HALF_DAY,
                "ot_hours": "0.00",
            },
        ]
        res = batch_mark_attendance(
            user=self.admin,
            org=self.org,
            project_id=self.project.id,
            date_val=target_date,
            records=records_data,
        )
        assert res["created"] == 2
        rec1 = Attendance.objects.get(employee=self.worker1, date=target_date)
        assert rec1.status == AttendanceStatus.PRESENT
        assert rec1.ot_hours == Decimal("1.50")

    def test_approve_and_lock_attendance_audited(self):
        """Approval locks records and creates audit log."""
        target_date = date(2026, 3, 12)
        batch_mark_attendance(
            user=self.admin,
            org=self.org,
            project_id=self.project.id,
            date_val=target_date,
            records=[{"employee_id": self.worker1.id, "status": AttendanceStatus.PRESENT}],
        )
        locked_count = approve_and_lock_attendance(
            user=self.admin,
            org=self.org,
            project_id=self.project.id,
            date_val=target_date,
        )
        assert locked_count == 1
        rec = Attendance.objects.get(employee=self.worker1, date=target_date)
        assert rec.is_locked is True

        audit = AuditLog.objects.filter(
            organization=self.org, action=AuditAction.ATTENDANCE_LOCKED
        ).first()
        assert audit is not None

    def test_unlock_attendance_requires_reason_and_audited(self):
        """Unlocking attendance requires a mandatory reason and logs an audit event."""
        target_date = date(2026, 3, 13)
        batch_mark_attendance(
            user=self.admin,
            org=self.org,
            project_id=self.project.id,
            date_val=target_date,
            records=[{"employee_id": self.worker1.id, "status": AttendanceStatus.PRESENT}],
        )
        approve_and_lock_attendance(
            user=self.admin, org=self.org, project_id=self.project.id, date_val=target_date
        )

        # Unlock without reason -> rejected
        with pytest.raises(BusinessRuleError, match="reason is required"):
            unlock_attendance(
                user=self.admin,
                org=self.org,
                project_id=self.project.id,
                date_val=target_date,
                reason="",
            )

        # Unlock with reason -> succeeded
        unlocked_count = unlock_attendance(
            user=self.admin,
            org=self.org,
            project_id=self.project.id,
            date_val=target_date,
            reason="Supervisor corrected mistake in morning headcount",
        )
        assert unlocked_count == 1
        rec = Attendance.objects.get(employee=self.worker1, date=target_date)
        assert rec.is_locked is False

    def test_close_day_attendance_marks_absent_and_holiday(self):
        """close_day_attendance automatically creates ABSENT rows or HOLIDAY rows."""
        # Non-holiday date
        res = close_day_attendance(
            user=self.admin,
            org=self.org,
            project_id=self.project.id,
            date_val=date(2026, 3, 15),
        )
        assert res["absents"] == 2
        assert res["holidays"] == 0

        # Create paid holiday
        Holiday.objects.create(
            organization=self.org,
            date=date(2026, 3, 16),
            name="Holi",
            is_paid=True,
        )
        res_hol = close_day_attendance(
            user=self.admin,
            org=self.org,
            project_id=self.project.id,
            date_val=date(2026, 3, 16),
        )
        assert res_hol["holidays"] == 2
        assert res_hol["absents"] == 0

    def test_attendance_summary_locked_records_only(self):
        """get_attendance_summary only counts locked records and calculates all components."""
        target_date = date(2026, 3, 22)
        # Unlocked record -> should NOT be counted in summary
        Attendance.objects.create(
            organization=self.org,
            employee=self.worker1,
            project=self.project,
            date=target_date,
            status=AttendanceStatus.PRESENT,
            is_locked=False,
            marked_by=self.admin,
        )
        summ_unlocked = get_attendance_summary([self.worker1.id], target_date, target_date)
        assert summ_unlocked[0].days_present == 0

        # Lock the record -> now counted
        Attendance.objects.filter(employee=self.worker1, date=target_date).update(is_locked=True)
        summ_locked = get_attendance_summary([self.worker1.id], target_date, target_date)
        assert summ_locked[0].days_present == 1

    def test_batch_mark_upcoming_date_rejected(self):
        """Attendance cannot be marked for upcoming/future dates."""
        future_date = timezone.localdate() + timedelta(days=2)
        with pytest.raises(BusinessRuleError) as exc:
            batch_mark_attendance(
                user=self.admin,
                org=self.org,
                project_id=self.project.id,
                date_val=future_date,
                records=[
                    {"employee_id": self.worker1.id, "status": AttendanceStatus.PRESENT},
                ],
            )
        assert exc.value.code == "future_attendance_not_allowed"

    def test_batch_mark_worker_not_assigned_to_project_rejected(self):
        """Worker cannot have attendance marked for a project they are not allocated to."""
        other_project = create_project(
            self.org,
            user=self.admin,
            data={"name": "Unauthorized Site", "code": "UNAUTH-01"},
        )
        with pytest.raises(BusinessRuleError) as exc:
            batch_mark_attendance(
                user=self.admin,
                org=self.org,
                date_val=timezone.localdate(),
                records=[
                    {
                        "employee_id": self.worker1.id,
                        "project_id": other_project.id,
                        "status": AttendanceStatus.PRESENT,
                    },
                ],
            )
        assert exc.value.code == "worker_not_assigned_to_project"
