"""
Attendance, Night Shift Sessions, and Holidays models.
"""

from decimal import Decimal

from django.db import models

from core.models import TenantModel


class ShiftType(models.TextChoices):
    DAY = "DAY", "Day Shift"
    NIGHT = "NIGHT", "Night Shift"


class AttendanceStatus(models.TextChoices):
    PRESENT = "PRESENT", "Present"
    HALF_DAY = "HALF_DAY", "Half Day"
    ABSENT = "ABSENT", "Absent"
    HOLIDAY = "HOLIDAY", "Holiday"


class AttendanceMethod(models.TextChoices):
    GPS = "GPS", "GPS Verified"
    MANUAL = "MANUAL", "Manual Entry"


class NightShiftStatus(models.TextChoices):
    IN_PROGRESS = "IN_PROGRESS", "In Progress"
    COMPLETED = "COMPLETED", "Completed"
    APPROVED = "APPROVED", "Approved"


class HolidayType(models.TextChoices):
    NATIONAL = "NATIONAL", "National Holiday"
    SITE_CLOSURE = "SITE_CLOSURE", "Site Closure"
    WEATHER = "WEATHER", "Weather Closure"


class NightShiftSession(TenantModel):
    """Night shift session with mandatory supervisor safety checklist."""

    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="night_shift_sessions"
    )
    shift_date = models.DateField()
    supervisor = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="supervised_night_shifts"
    )
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    safety_checklist_signed = models.BooleanField(default=False)
    checklist_notes = models.TextField(blank=True)
    work_completed = models.TextField(blank=True)
    status = models.CharField(
        max_length=20, choices=NightShiftStatus.choices, default=NightShiftStatus.IN_PROGRESS
    )
    approved_by = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="approved_night_shifts",
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-shift_date", "-id"]

    def __str__(self):
        return f"{self.project.code} Night Shift {self.shift_date} ({self.status})"


class Holiday(TenantModel):
    """Organization-wide or project-specific calendar holidays."""

    project = models.ForeignKey(
        "projects.Project",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="holidays",
        help_text="Null indicates organization-wide holiday",
    )
    date = models.DateField()
    name = models.CharField(max_length=150)
    holiday_type = models.CharField(
        max_length=30, choices=HolidayType.choices, default=HolidayType.NATIONAL
    )
    is_paid = models.BooleanField(default=True)

    class Meta:
        ordering = ["date"]
        unique_together = ("organization", "project", "date")

    def __str__(self):
        return f"{self.date} - {self.name} (Paid: {self.is_paid})"


class Attendance(TenantModel):
    """Daily attendance record for workers."""

    employee = models.ForeignKey(
        "workforce.Employee", on_delete=models.CASCADE, related_name="attendance_records"
    )
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="attendance_records"
    )
    date = models.DateField()
    shift_type = models.CharField(max_length=10, choices=ShiftType.choices, default=ShiftType.DAY)
    status = models.CharField(
        max_length=20, choices=AttendanceStatus.choices, default=AttendanceStatus.PRESENT
    )

    check_in_time = models.DateTimeField(null=True, blank=True)
    check_out_time = models.DateTimeField(null=True, blank=True)
    worked_hours = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    ot_hours = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))

    # GPS Geofence verification details
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    distance_m = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_geofence_verified = models.BooleanField(default=False)
    method = models.CharField(
        max_length=10, choices=AttendanceMethod.choices, default=AttendanceMethod.GPS
    )

    night_shift = models.ForeignKey(
        NightShiftSession,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="roster_attendance",
    )
    remarks = models.TextField(blank=True)
    marked_by = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="attendance_marked"
    )

    # Immutability approval lock
    is_locked = models.BooleanField(default=False)
    locked_at = models.DateTimeField(null=True, blank=True)
    locked_by = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="locked_attendance",
    )

    class Meta:
        ordering = ["-date", "-id"]
        unique_together = ("organization", "employee", "date", "shift_type")
        indexes = [
            models.Index(fields=["organization", "project", "date"]),
            models.Index(fields=["organization", "is_locked"]),
        ]

    def __str__(self):
        return f"{self.employee.employee_code} - {self.date} ({self.status})"
