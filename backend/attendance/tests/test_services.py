from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from accounts.services import accept_invitation, create_organization
from attendance.models import (
    Attendance,
    AttendanceStatus,
    Holiday,
    NightShiftStatus,
    ShiftType,
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
    get_attendance_summary,
    haversine_m,
    unlock_attendance,
)
from audit.constants import AuditAction
from audit.models import AuditLog
from core.exceptions import BusinessRuleError, ConflictError
from projects.services import create_project
from workforce.services import create_employee, create_labor_group


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
                "geofence_lat": Decimal("19.076000"),
                "geofence_lng": Decimal("72.877700"),
                "geofence_radius_m": 200,
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

    def test_haversine_distance_calculation(self):
        """Haversine calculates accurate distance in meters."""
        # Same coordinates -> 0 meters
        d_zero = haversine_m(19.076000, 72.877700, 19.076000, 72.877700)
        assert round(d_zero, 1) == 0.0

        # ~111 meters North (approx 0.001 deg lat)
        d_100m = haversine_m(19.076000, 72.877700, 19.077000, 72.877700)
        assert 100 <= d_100m <= 120

    def test_check_in_inside_geofence(self):
        """Worker check-in inside geofence radius succeeds."""
        # 50m away from site center
        rec = check_in_worker(
            user=self.admin,
            org=self.org,
            employee_id=self.worker1.id,
            project_id=self.project.id,
            latitude=19.076200,
            longitude=72.877700,
        )
        assert rec.status == AttendanceStatus.PRESENT
        assert rec.is_geofence_verified is True
        assert rec.check_in_time is not None
        assert rec.distance_m <= Decimal("200.00")

    def test_check_in_outside_geofence_rejected_and_audited(self):
        """Worker check-in outside radius raises outside_geofence and logs audit event."""
        # 1 km away
        with pytest.raises(BusinessRuleError, match="Outside project geofence boundary") as exc:
            check_in_worker(
                user=self.admin,
                org=self.org,
                employee_id=self.worker1.id,
                project_id=self.project.id,
                latitude=19.090000,
                longitude=72.877700,
            )
        assert exc.value.code == "outside_geofence"

        # Check audit log written
        audit = AuditLog.objects.filter(
            organization=self.org, action=AuditAction.ATTENDANCE_OFFSITE_ATTEMPT
        ).first()
        assert audit is not None
        assert audit.changes["employee_id"] == self.worker1.id

    def test_duplicate_check_in_rejected(self):
        """Checking in twice for the same date and shift raises ConflictError."""
        check_in_worker(
            user=self.admin,
            org=self.org,
            employee_id=self.worker1.id,
            project_id=self.project.id,
            latitude=19.076000,
            longitude=72.877700,
        )
        with pytest.raises(ConflictError, match="already checked in"):
            check_in_worker(
                user=self.admin,
                org=self.org,
                employee_id=self.worker1.id,
                project_id=self.project.id,
                latitude=19.076000,
                longitude=72.877700,
            )

    def test_check_out_and_overtime_calculation(self):
        """Check-out sets check-out time, worked hours, and overtime hours."""
        rec = check_in_worker(
            user=self.admin,
            org=self.org,
            employee_id=self.worker1.id,
            project_id=self.project.id,
            latitude=19.076000,
            longitude=72.877700,
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
        assert checked_out.worked_hours >= Decimal("9.50")
        # Overtime after 8 hours = 1.50
        assert checked_out.ot_hours >= Decimal("1.50")
        assert checked_out.status == AttendanceStatus.PRESENT

    def test_batch_mark_labor_group(self):
        """Batch marking a labor gang marks all active members."""
        group = create_labor_group(self.org, self.project, name="Gang Mason Alpha")
        self.worker1.group = group
        self.worker1.save(update_fields=["group"])
        self.worker2.group = group
        self.worker2.save(update_fields=["group"])

        result = batch_mark_attendance(
            user=self.admin,
            org=self.org,
            project_id=self.project.id,
            date_val=date(2026, 3, 10),
            group_id=group.id,
            group_status=AttendanceStatus.PRESENT,
        )
        assert result["created"] == 2
        assert Attendance.objects.filter(project=self.project, date=date(2026, 3, 10)).count() == 2

    def test_approve_and_lock_attendance_and_unlock(self):
        """Locking marks rows immutable; admin unlock requires reason."""
        batch_mark_attendance(
            user=self.admin,
            org=self.org,
            project_id=self.project.id,
            date_val=date(2026, 3, 10),
            records=[
                {"employee_id": self.worker1.id, "status": AttendanceStatus.PRESENT},
                {"employee_id": self.worker2.id, "status": AttendanceStatus.PRESENT},
            ],
        )

        locked_count = approve_and_lock_attendance(
            user=self.admin,
            org=self.org,
            project_id=self.project.id,
            date_val=date(2026, 3, 10),
        )
        assert locked_count == 2
        assert Attendance.objects.filter(date=date(2026, 3, 10), is_locked=True).count() == 2

        # Try unlocking without reason -> rejected
        with pytest.raises(BusinessRuleError, match="reason is required"):
            unlock_attendance(
                user=self.admin,
                org=self.org,
                project_id=self.project.id,
                date_val=date(2026, 3, 10),
                reason="",
            )

        # Unlock with reason -> succeeded
        unlocked_count = unlock_attendance(
            user=self.admin,
            org=self.org,
            project_id=self.project.id,
            date_val=date(2026, 3, 10),
            reason="Correct supervisor omission",
        )
        assert unlocked_count == 2
        assert Attendance.objects.filter(date=date(2026, 3, 10), is_locked=False).count() == 2

    def test_close_day_with_and_without_holiday(self):
        """Close-day marks active workers with no DAY record as HOLIDAY or ABSENT."""
        # 1. Day without holiday -> marks ABSENT
        res_no_hol = close_day_attendance(
            user=self.admin,
            org=self.org,
            project_id=self.project.id,
            date_val=date(2026, 3, 15),
        )
        assert res_no_hol["absents"] == 2
        assert res_no_hol["holidays"] == 0

        # 2. Configure holiday for next date
        Holiday.objects.create(
            organization=self.org,
            project=self.project,
            date=date(2026, 3, 16),
            name="Holi Festival",
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

    def test_night_shift_session_lifecycle(self):
        """Night shift session requires checklist, creates NIGHT rows, completes and approves."""
        # Attempt without checklist -> rejected
        with pytest.raises(BusinessRuleError, match="safety checklist"):
            create_night_shift_session(
                user=self.admin,
                org=self.org,
                project_id=self.project.id,
                shift_date=date(2026, 3, 20),
                employee_ids=[self.worker1.id],
                safety_checklist_signed=False,
            )

        # Create session with checklist
        session = create_night_shift_session(
            user=self.admin,
            org=self.org,
            project_id=self.project.id,
            shift_date=date(2026, 3, 20),
            employee_ids=[self.worker1.id],
            safety_checklist_signed=True,
            checklist_notes="PPE helmets and reflector jackets checked",
        )
        assert session.status == NightShiftStatus.IN_PROGRESS
        roster_rows = Attendance.objects.filter(night_shift=session)
        assert roster_rows.count() == 1
        assert roster_rows.first().shift_type == ShiftType.NIGHT

        # Complete session
        complete_night_shift_session(
            user=self.admin,
            session=session,
            work_completed="Poured foundation slab",
        )
        session.refresh_from_db()
        assert session.status == NightShiftStatus.COMPLETED

        # Approve session -> locks roster rows
        approve_night_shift_session(
            user=self.admin,
            session=session,
        )
        session.refresh_from_db()
        assert session.status == NightShiftStatus.APPROVED
        assert roster_rows.first().is_locked is True

    def test_attendance_summary_locked_records_only(self):
        """get_attendance_summary only counts locked records and calculates all components."""
        target_date = date(2026, 3, 22)
        # Unlocked record -> should NOT be counted in summary
        Attendance.objects.create(
            organization=self.org,
            employee=self.worker1,
            project=self.project,
            date=target_date,
            shift_type=ShiftType.DAY,
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
