"""
Payroll services and pure calculation formula.
Contracts:
- calculate_voucher(employee, summary, open_advances, org) -> dict
- create_run(user, project, period_start, period_end) -> PayrollRun
- recalculate_run(run, user) -> PayrollRun
- approve_run(run, approver) -> PayrollRun
- cancel_run(run, user, reason)
- record_advance(user, data) -> Advance
- mark_voucher_paid(voucher, user, reference="")
"""

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from attendance.services import AttendanceSummary
from core.exceptions import BusinessRuleError
from core.money import q2
from core.sequences import next_number
from payroll.models import (
    Advance,
    AdvanceStatus,
    PayrollRun,
    PayrollRunStatus,
    PayrollVoucher,
    VoucherStatus,
)


def calculate_voucher(
    employee,
    summary: AttendanceSummary,
    open_advances: Decimal,
    org,
) -> dict:
    """
    Pure calculation function for a single worker's wage breakdown:
    - basic_pay = (days_present + 0.5 * half_days + paid_holidays) * rate
    - ot_pay = ot_hours * ot_rate
    - night_allowance = night_shifts * rate * (night_shift_multiplier - 1)
    - gross = basic + ot + night
    - net = gross - advances_deducted (FIFO, bounded by gross)
    """
    rate = employee.effective_daily_rate
    ot_rate = q2(employee.ot_hourly_rate)
    multiplier = Decimal(str(org.night_shift_multiplier))

    # Basic Pay calculation
    units = (
        Decimal(str(summary.days_present))
        + (Decimal("0.5") * Decimal(str(summary.half_days)))
        + Decimal(str(summary.paid_holidays))
    )
    basic_pay = q2(units * rate)

    # Overtime Pay calculation
    ot_pay = q2(Decimal(str(summary.ot_hours)) * ot_rate)

    # Night Shift Allowance
    night_factor = max(Decimal("0.00"), multiplier - Decimal("1.00"))
    night_allowance = q2(Decimal(str(summary.night_shifts)) * rate * night_factor)

    # Gross Pay
    gross_pay = q2(basic_pay + ot_pay + night_allowance)

    # Advance deduction bounded by open advances and gross pay
    advances_deducted = min(q2(open_advances), gross_pay)
    net_pay = q2(gross_pay - advances_deducted)

    # Default payment mode based on employee bank/UPI availability
    payment_mode = "CASH"
    if employee.upi_id:
        payment_mode = "UPI"
    elif employee.bank_account_number:
        payment_mode = "BANK_TRANSFER"

    return {
        "employee_id": employee.id,
        "daily_rate_used": rate,
        "ot_rate_used": ot_rate,
        "days_present": summary.days_present,
        "half_days": summary.half_days,
        "paid_holidays": summary.paid_holidays,
        "ot_hours": summary.ot_hours,
        "night_shifts": summary.night_shifts,
        "basic_pay": basic_pay,
        "ot_pay": ot_pay,
        "night_allowance": night_allowance,
        "gross_pay": gross_pay,
        "advances_deducted": advances_deducted,
        "net_pay": net_pay,
        "payment_mode": payment_mode,
    }


def record_advance(user, data: dict) -> Advance:
    """Record a cash advance given to a worker and post to double-entry ledger."""
    from ledger.services import post_journal_entry

    org = user.organization
    amount = q2(data["amount"])
    payment_mode = data.get("payment_mode", "CASH")

    with transaction.atomic():
        adv = Advance.objects.create(
            organization=org,
            employee=data["employee"],
            project=data["project"],
            amount=amount,
            advance_date=data["advance_date"],
            reason=data.get("reason", ""),
            payment_mode=payment_mode,
            given_by=user,
            status=AdvanceStatus.OPEN,
        )

        credit_acct = "1001" if payment_mode == "CASH" else "1002"
        lines = [
            {
                "account_code": "1100",
                "side": "DR",
                "amount": amount,
                "memo": f"Advance to {adv.employee.employee_code}",
            },
            {
                "account_code": credit_acct,
                "side": "CR",
                "amount": amount,
                "memo": f"Advance disbursement via {payment_mode}",
            },
        ]
        entry = post_journal_entry(
            org=org,
            date=adv.advance_date,
            description=f"Advance #{adv.id} to {adv.employee.employee_code}",
            lines=lines,
            reference_type="ADVANCE",
            reference_id=adv.id,
            user=user,
            project=adv.project,
        )
        adv.journal_entry = entry
        adv.save(update_fields=["journal_entry"])

    return adv


def create_run(user, project, period_start, period_end) -> PayrollRun:
    """Create a new DRAFT payroll run for a project period."""
    org = user.organization
    # Check overlapping active runs
    existing = (
        PayrollRun.objects.filter(
            project=project,
            period_start__lte=period_end,
            period_end__gte=period_start,
        )
        .exclude(status=PayrollRunStatus.CANCELLED)
        .exists()
    )
    if existing:
        raise BusinessRuleError(
            "A payroll run with an overlapping period already exists.", code="overlap_error"
        )

    run = PayrollRun.objects.create(
        organization=org,
        project=project,
        period_start=period_start,
        period_end=period_end,
        status=PayrollRunStatus.DRAFT,
        created_by=user,
    )
    return recalculate_run(run, user)


def recalculate_run(run: PayrollRun, user) -> PayrollRun:
    """Recompute all vouchers for a draft run using locked attendance and open advances."""
    if run.status != PayrollRunStatus.DRAFT:
        raise BusinessRuleError(
            "Only DRAFT payroll runs can be recalculated.", code="invalid_status"
        )

    from attendance.services import get_attendance_summary
    from workforce.models import Employee

    org = run.organization
    employees = Employee.objects.filter(organization=org, is_active=True)
    emp_ids = list(employees.values_list("id", flat=True))

    summaries = get_attendance_summary(
        emp_ids, run.period_start, run.period_end, project=run.project
    )
    summary_map = {s.employee_id: s for s in summaries}

    with transaction.atomic():
        run.vouchers.all().delete()

        tot_gross = Decimal("0.00")
        tot_adv = Decimal("0.00")
        tot_net = Decimal("0.00")

        for emp in employees:
            s = summary_map.get(emp.id)
            if not s or (s.days_present == 0 and s.half_days == 0 and s.paid_holidays == 0):
                continue  # Exclude workers with zero attendance

            # Calculate open advances
            open_adv = Decimal("0.00")
            for adv in Advance.objects.filter(
                employee=emp, status__in=[AdvanceStatus.OPEN, AdvanceStatus.PARTIALLY_ADJUSTED]
            ):
                open_adv += adv.remaining_amount

            calc = calculate_voucher(emp, s, open_adv, org)
            vch_number = next_number(org, key="VCH", prefix="VCH-", width=6)

            PayrollVoucher.objects.create(
                organization=org,
                run=run,
                employee=emp,
                voucher_number=vch_number,
                days_present=calc["days_present"],
                half_days=calc["half_days"],
                paid_holidays=calc["paid_holidays"],
                ot_hours=calc["ot_hours"],
                night_shifts=calc["night_shifts"],
                daily_rate_used=calc["daily_rate_used"],
                ot_rate_used=calc["ot_rate_used"],
                basic_pay=calc["basic_pay"],
                ot_pay=calc["ot_pay"],
                night_allowance=calc["night_allowance"],
                gross_pay=calc["gross_pay"],
                advances_deducted=calc["advances_deducted"],
                net_pay=calc["net_pay"],
                payment_mode=calc["payment_mode"],
                status=VoucherStatus.PENDING,
            )

            tot_gross += calc["gross_pay"]
            tot_adv += calc["advances_deducted"]
            tot_net += calc["net_pay"]

        run.total_gross = tot_gross
        run.total_advances = tot_adv
        run.total_net = tot_net
        run.save(update_fields=["total_gross", "total_advances", "total_net", "updated_at"])

    return run


def approve_run(run: PayrollRun, approver) -> PayrollRun:
    """Approve payroll run, post journal entry, adjust advances FIFO, update project spend."""
    if run.status != PayrollRunStatus.DRAFT:
        raise BusinessRuleError("Only DRAFT runs can be approved.", code="invalid_status")
    if run.created_by_id == approver.id and getattr(approver, "role", "") == "ACCOUNTANT":
        raise BusinessRuleError(
            "Segregation of duties: Creator cannot approve their own payroll run.",
            code="segregation_error",
        )

    from ledger.services import post_journal_entry
    from projects.services import update_spend

    org = run.organization

    with transaction.atomic():
        # Adjust advances FIFO
        for voucher in run.vouchers.all():
            deduction_remaining = voucher.advances_deducted
            if deduction_remaining > Decimal("0.00"):
                open_advances = Advance.objects.filter(
                    employee=voucher.employee,
                    status__in=[AdvanceStatus.OPEN, AdvanceStatus.PARTIALLY_ADJUSTED],
                ).order_by("advance_date", "id")

                for adv in open_advances:
                    if deduction_remaining <= Decimal("0.00"):
                        break
                    avail = adv.remaining_amount
                    if avail <= deduction_remaining:
                        adv.adjusted_amount += avail
                        adv.status = AdvanceStatus.ADJUSTED
                        deduction_remaining -= avail
                    else:
                        adv.adjusted_amount += deduction_remaining
                        adv.status = AdvanceStatus.PARTIALLY_ADJUSTED
                        deduction_remaining = Decimal("0.00")
                    adv.save(update_fields=["adjusted_amount", "status", "updated_at"])

        # Calculate cash vs bank net payouts
        cash_net = Decimal("0.00")
        bank_net = Decimal("0.00")
        for v in run.vouchers.all():
            if v.payment_mode == "CASH":
                cash_net += v.net_pay
            else:
                bank_net += v.net_pay

        # Double-entry ledger lines:
        # DR 5005 Wages Expense = total_gross
        # CR 1100 Worker Advances = total_advances
        # CR 1001 Cash = cash_net
        # CR 1002 Bank = bank_net
        lines = [
            {
                "account_code": "5005",
                "side": "DR",
                "amount": run.total_gross,
                "memo": f"Wages expense for Payroll #{run.id}",
            },
        ]
        if run.total_advances > Decimal("0.00"):
            lines.append(
                {
                    "account_code": "1100",
                    "side": "CR",
                    "amount": run.total_advances,
                    "memo": "Recovery of worker advances",
                }
            )
        if cash_net > Decimal("0.00"):
            lines.append(
                {
                    "account_code": "1001",
                    "side": "CR",
                    "amount": cash_net,
                    "memo": "Cash net wage payout",
                }
            )
        if bank_net > Decimal("0.00"):
            lines.append(
                {
                    "account_code": "1002",
                    "side": "CR",
                    "amount": bank_net,
                    "memo": "Bank/UPI net wage payout",
                }
            )

        entry = post_journal_entry(
            org=org,
            date=run.period_end,
            description=f"Payroll Run #{run.id} Settlement ({run.period_start} to {run.period_end})",
            lines=lines,
            reference_type="PAYROLL",
            reference_id=run.id,
            user=approver,
            project=run.project,
        )

        update_spend(run.project, run.total_gross, reason=f"Payroll Run #{run.id}")

        run.status = PayrollRunStatus.APPROVED
        run.approved_by = approver
        run.approved_at = timezone.now()
        run.journal_entry = entry
        run.save(
            update_fields=["status", "approved_by", "approved_at", "journal_entry", "updated_at"]
        )

    return run


def cancel_run(run: PayrollRun, user, reason: str):
    """Cancel a draft or approved payroll run."""
    if run.status == PayrollRunStatus.APPROVED:
        if run.vouchers.filter(status=VoucherStatus.PAID).exists():
            raise BusinessRuleError(
                "Cannot cancel payroll run because one or more vouchers are already paid.",
                code="cannot_cancel",
            )

        from ledger.services import reverse_entry
        from projects.services import update_spend

        with transaction.atomic():
            if run.journal_entry:
                reverse_entry(
                    run.journal_entry, user=user, reason=f"Cancelled Payroll #{run.id}: {reason}"
                )
            update_spend(run.project, -run.total_gross, reason=f"Cancelled Payroll #{run.id}")
            run.status = PayrollRunStatus.CANCELLED
            run.notes = f"Cancelled: {reason}"
            run.save(update_fields=["status", "notes", "updated_at"])
    else:
        run.status = PayrollRunStatus.CANCELLED
        run.save(update_fields=["status", "updated_at"])


def mark_voucher_paid(voucher: PayrollVoucher, user, reference: str = ""):
    """Mark individual voucher paid."""
    voucher.status = VoucherStatus.PAID
    voucher.paid_at = timezone.now()
    voucher.payment_reference = reference
    voucher.save(update_fields=["status", "paid_at", "payment_reference", "updated_at"])

    # Check if all vouchers in run are paid -> update run status to PAID
    run = voucher.run
    if not run.vouchers.filter(status=VoucherStatus.PENDING).exists():
        run.status = PayrollRunStatus.PAID
        run.save(update_fields=["status", "updated_at"])
