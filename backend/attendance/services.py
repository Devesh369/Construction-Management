"""
Attendance services, geofence Haversine calculation, and AttendanceSummary contract.
"""

import math
from dataclasses import dataclass
from decimal import Decimal

from django.db.models import Q, Sum

from attendance.models import Attendance, AttendanceStatus, Holiday, ShiftType


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two GPS coordinates in meters.
    Formula:
        R = 6371000 meters
        a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)
        d = 2 * R * asin(√a)
    """
    r = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

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
                ot_hours=ot_total,
                night_shifts=night_shifts,
            )
        )

    return summaries
