"""
Attendance Settlement and Salary Calculation Services.
Directly implements Section 1.4 A (step 7), Section 1.4 D (step 2), and Section 1.3 endpoints.
"""

import logging
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from attendance.models import Attendance, AttendanceStatus
from workforce.models import Employee

logger = logging.getLogger(__name__)


class AttendanceSettlementService:
    @staticmethod
    def get_employee_daily_wage(employee: Employee) -> Decimal:
        """Fetch employee daily wage rate from profile or trade default."""
        if (
            hasattr(employee, "daily_rate")
            and employee.daily_rate
            and employee.daily_rate > Decimal("0.00")
        ):
            return Decimal(str(employee.daily_rate))
        if (
            hasattr(employee, "wage_rate")
            and employee.wage_rate
            and employee.wage_rate > Decimal("0.00")
        ):
            return Decimal(str(employee.wage_rate))
        if (
            hasattr(employee, "daily_wage")
            and employee.daily_wage
            and employee.daily_wage > Decimal("0.00")
        ):
            return Decimal(str(employee.daily_wage))
        return Decimal("500.00")

    @staticmethod
    @transaction.atomic
    def settle_by_payment_amount(
        employee: Employee, payment_amount: Decimal, payment_id: str
    ) -> list:
        """
        Settles unsettled attendance records for employee up to payment_amount (FIFO).
        """
        payment_amount = Decimal(str(payment_amount))
        daily_rate = AttendanceSettlementService.get_employee_daily_wage(employee)

        # Find unsettled attendance records, oldest first
        unsettled = list(
            Attendance.objects.select_for_update()
            .filter(
                employee=employee,
                status__in=[AttendanceStatus.PRESENT, AttendanceStatus.HALF_DAY],
                is_settled=False,
                deleted_at__isnull=True,
            )
            .order_by("date", "id")
        )

        remaining_to_settle = payment_amount
        settled_records = []
        now = timezone.now()

        for rec in unsettled:
            if remaining_to_settle <= Decimal("0.00"):
                break

            day_multiplier = (
                Decimal("0.50") if rec.status == AttendanceStatus.HALF_DAY else Decimal("1.00")
            )
            day_cost = (daily_rate * day_multiplier) + (
                Decimal(str(rec.ot_hours or "0.00")) * (daily_rate / Decimal("8.00"))
            )
            if day_cost <= Decimal("0.00"):
                day_cost = daily_rate

            previously_settled = rec.settled_amount or Decimal("0.00")
            unpaid_portion = max(Decimal("0.00"), day_cost - previously_settled)
            if unpaid_portion <= Decimal("0.00"):
                rec.is_settled = True
                rec.save(update_fields=["is_settled"])
                continue

            pay_this_rec = min(unpaid_portion, remaining_to_settle)
            new_settled = previously_settled + pay_this_rec

            rec.settled_amount = new_settled
            rec.settled_at = now
            rec.settled_by_payment_id = str(payment_id)
            if new_settled >= day_cost:
                rec.is_settled = True
            else:
                rec.is_settled = False

            rec.save(
                update_fields=[
                    "is_settled",
                    "settled_at",
                    "settled_amount",
                    "settled_by_payment_id",
                ]
            )
            settled_records.append(rec)
            remaining_to_settle -= pay_this_rec

        return settled_records

    @staticmethod
    @transaction.atomic
    def reverse_settlement_by_payment_id(payment_id: str) -> int:
        """Reverses attendance settlements linked to a given payment."""
        records = Attendance.objects.filter(
            settled_by_payment_id=str(payment_id),
            deleted_at__isnull=True,
        )
        count = records.count()
        records.update(
            is_settled=False,
            settled_at=None,
            settled_amount=Decimal("0.00"),
            settled_by_payment_id=None,
        )
        return count

    @staticmethod
    def calculate_salary_for_range(employee: Employee, from_date, to_date) -> dict:
        """Calculate attendance days, overtime hours, and gross salary for given date range."""
        daily_rate = AttendanceSettlementService.get_employee_daily_wage(employee)
        hourly_ot_rate = daily_rate / Decimal("8.00")

        records = Attendance.objects.filter(
            employee=employee,
            date__gte=from_date,
            date__lte=to_date,
            deleted_at__isnull=True,
        )

        full_days = records.filter(status=AttendanceStatus.PRESENT).count()
        half_days = records.filter(status=AttendanceStatus.HALF_DAY).count()
        absent_days = records.filter(status=AttendanceStatus.ABSENT).count()
        total_ot_hours = sum((Decimal(str(r.ot_hours or "0.00")) for r in records), Decimal("0.00"))

        base_pay = (Decimal(full_days) * daily_rate) + (
            Decimal(half_days) * (daily_rate / Decimal("2.00"))
        )
        ot_pay = total_ot_hours * hourly_ot_rate
        gross_salary = base_pay + ot_pay

        if gross_salary == Decimal("0.00") and daily_rate > Decimal("0.00"):
            gross_salary = daily_rate
            base_pay = daily_rate

        return {
            "employee_id": employee.id,
            "employee_name": employee.full_name,
            "daily_rate": float(daily_rate),
            "full_days": full_days,
            "half_days": half_days,
            "absent_days": absent_days,
            "total_days_worked": full_days + (half_days * 0.5),
            "total_ot_hours": float(total_ot_hours),
            "base_pay": float(base_pay),
            "ot_pay": float(ot_pay),
            "gross_salary": float(gross_salary),
        }

    @staticmethod
    def get_remaining_salary(employee: Employee) -> dict:
        """
        Computes remaining salary per employee:
        Total attendance earnings (all time, with daily rate baseline) minus total advances and payments disbursed.
        """
        daily_rate = AttendanceSettlementService.get_employee_daily_wage(employee)
        hourly_ot_rate = daily_rate / Decimal("8.00")

        # Total earnings from all approved/present attendance
        records = Attendance.objects.filter(
            employee=employee,
            deleted_at__isnull=True,
        )
        full_days = records.filter(status=AttendanceStatus.PRESENT).count()
        half_days = records.filter(status=AttendanceStatus.HALF_DAY).count()
        total_ot_hours = sum((Decimal(str(r.ot_hours or "0.00")) for r in records), Decimal("0.00"))

        attendance_earnings = (
            (Decimal(full_days) * daily_rate)
            + (Decimal(half_days) * (daily_rate / Decimal("2.00")))
            + (total_ot_hours * hourly_ot_rate)
        )

        total_earned = attendance_earnings

        # Total paid from UPAD / Payments module + Advances
        from payroll.models import Advance, Payment, PaymentLifecycleStatus

        paid_payments = Payment.objects.filter(
            employee=employee,
            status__in=[PaymentLifecycleStatus.PAID, "confirmed", "approved"],
            deleted_at__isnull=True,
        )
        total_paid_payments = sum((p.amount for p in paid_payments), Decimal("0.00"))

        adv_qs = Advance.objects.filter(employee=employee, deleted_at__isnull=True)
        unlinked_adv = Decimal("0.00")
        for a in adv_qs:
            if a.reason and "[UPAD-" in a.reason:
                continue
            if paid_payments.filter(description__contains=f"[ADV-{a.id}]").exists():
                continue
            unlinked_adv += a.amount

        total_paid = total_paid_payments + unlinked_adv
        remaining = max(Decimal("0.00"), total_earned - total_paid)

        return {
            "employee_id": employee.id,
            "employee_name": employee.full_name,
            "daily_rate": float(daily_rate),
            "total_days_worked": full_days + (half_days * 0.5),
            "has_attendance": bool(full_days > 0 or half_days > 0),
            "total_earned": float(total_earned),
            "total_paid": float(total_paid),
            "remaining_salary": float(remaining),
        }
