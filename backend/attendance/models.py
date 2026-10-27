"""
Attendance and Holidays models.
Simplified to standard daily attendance without GPS or shift requirements.
"""

from decimal import Decimal

from django.db import models

from core.models import TenantModel


class AttendanceStatus(models.TextChoices):
    PRESENT = "PRESENT", "Present"
    HALF_DAY = "HALF_DAY", "Half Day"
    ABSENT = "ABSENT", "Absent"
    HOLIDAY = "HOLIDAY", "Holiday"


class HolidayType(models.TextChoices):
    NATIONAL = "NATIONAL", "National Holiday"
    SITE_CLOSURE = "SITE_CLOSURE", "Site Closure"
    WEATHER = "WEATHER", "Weather Closure"


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
    status = models.CharField(
        max_length=20, choices=AttendanceStatus.choices, default=AttendanceStatus.PRESENT
    )

    check_in_time = models.DateTimeField(null=True, blank=True)
    check_out_time = models.DateTimeField(null=True, blank=True)
    worked_hours = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    ot_hours = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))

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

    # Financial settlement (cleared against UPAD / Salary payments)
    is_settled = models.BooleanField(default=False)
    settled_at = models.DateTimeField(null=True, blank=True)
    settled_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    settled_by_payment_id = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        ordering = ["-date", "-id"]
        unique_together = ("organization", "employee", "date")
        indexes = [
            models.Index(fields=["organization", "project", "date"]),
            models.Index(fields=["organization", "is_locked"]),
        ]

    def __str__(self):
        return f"{self.employee.employee_code} - {self.date} ({self.status})"
