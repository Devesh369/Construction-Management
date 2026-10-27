"""
Payroll services and pure calculation formula.
Single source of truth for UC-23, UC-24, and UC-25.
"""

import io
import os
from datetime import date
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from accounts.models import User

LETTERHEAD_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "reports",
    "assets",
    "buildsphere_letterhead.png",
)


def draw_letterhead_background(canvas_obj, doc):
    """Draw official BuildSphere AI letterhead background for worker payslips."""
    canvas_obj.saveState()
    page_w, page_h = doc.pagesize
    if os.path.exists(LETTERHEAD_PATH):
        canvas_obj.drawImage(
            LETTERHEAD_PATH,
            0,
            0,
            width=page_w,
            height=page_h,
            preserveAspectRatio=False,
        )
    canvas_obj.restoreState()
from attendance.models import Attendance
from attendance.services import AttendanceSummary, get_attendance_summary
from audit.constants import AuditAction
from audit.services import log_action
from core.exceptions import BusinessRuleError
from core.money import q2
from core.sequences import next_number
from ledger.services import post_journal_entry, reverse_entry
from payroll.models import (
    Advance,
    AdvanceStatus,
    PayrollRun,
    PayrollRunStatus,
    PayrollVoucher,
    VoucherStatus,
)
from projects.models import Project
from projects.services import update_spend
from workforce.models import Employee


def calculate_voucher(
    employee,
    summary: AttendanceSummary,
    open_advances: Decimal,
    org,
) -> dict:
    """
    Pure calculation function for a single worker's wage breakdown (UC-24 / Section 6 worked example):
    - basic_pay = (days_present + 0.5 * half_days + paid_holidays) * rate
    - ot_pay = ot_hours * ot_rate
    - night_allowance = night_shifts * rate * (night_shift_multiplier - 1)
    - gross = basic + ot + night
    - net = gross - advances_deducted (FIFO, bounded by open advances and gross)
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

    # Night Shift Allowance: rate * (multiplier - 1.0) per night shift
    night_factor = max(Decimal("0.00"), multiplier - Decimal("1.00"))
    night_allowance = q2(Decimal(str(summary.night_shifts)) * rate * night_factor)

    # Gross Pay
    gross_pay = q2(basic_pay + ot_pay + night_allowance)

    # Advance deduction bounded by open advances and gross pay
    advances_deducted = min(q2(open_advances), gross_pay)
    net_pay = q2(gross_pay - advances_deducted)

    # Default payment mode based on worker profile
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


def record_advance(user: User, data: dict, request=None) -> Advance:
    """
    UC-23: Give a cash advance to a worker.
    - Status set to OPEN.
    - Debit 1100 Worker Advances, Credit 1001 Cash or 1002 Bank.
    - Audited.
    """
    org = user.organization
    amount = q2(data["amount"])
    if amount <= Decimal("0.00"):
        raise BusinessRuleError("Advance amount must be greater than zero.", code="invalid_amount")

    payment_mode = data.get("payment_mode", "CASH")
    credit_acct = "1001" if payment_mode == "CASH" else "1002"

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

        lines = [
            {
                "account_code": "1100",
                "side": "DR",
                "amount": amount,
                "memo": f"Advance to {adv.employee.employee_code} ({adv.employee.full_name})",
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

        log_action(
            user=user,
            action=AuditAction.ADVANCE_GIVEN,
            obj=adv,
            changes={"amount": str(amount), "employee_id": adv.employee.id},
            request=request,
            organization=org,
        )

    return adv


def create_run(
    user: User,
    project: Project,
    period_start: date,
    period_end: date,
    request=None,
) -> tuple[PayrollRun, list[str]]:
    """
    UC-24: Create a DRAFT payroll run for a project and period.
    - Validates date range (end >= start, end <= today).
    - Blocks overlapping active runs for the project.
    - Computes vouchers and returns warnings for excluded unlocked attendance records.
    """
    org = user.organization
    if period_end < period_start:
        raise BusinessRuleError(
            "Period end date cannot be earlier than start date.",
            code="invalid_period",
        )

    today = timezone.localdate()
    if period_end > today:
        raise BusinessRuleError(
            "Period end date cannot be in the future.",
            code="future_period",
        )

    # Check overlapping active runs
    existing_overlap = (
        PayrollRun.objects.filter(
            project=project,
            period_start__lte=period_end,
            period_end__gte=period_start,
        )
        .exclude(status=PayrollRunStatus.CANCELLED)
        .exists()
    )
    if existing_overlap:
        raise BusinessRuleError(
            "A payroll run with an overlapping period already exists for this project.",
            code="overlap_error",
        )

    run = PayrollRun.objects.create(
        organization=org,
        project=project,
        period_start=period_start,
        period_end=period_end,
        status=PayrollRunStatus.DRAFT,
        created_by=user,
    )

    warnings = recalculate_run(run, user=user)

    log_action(
        user=user,
        action=AuditAction.PAYROLL_CREATED,
        obj=run,
        changes={
            "project_id": project.id,
            "period_start": str(period_start),
            "period_end": str(period_end),
            "total_gross": str(run.total_gross),
        },
        request=request,
        organization=org,
    )

    return run, warnings


def recalculate_run(run: PayrollRun, user: User) -> list[str]:
    """
    UC-24: Recompute all vouchers for a draft run using locked attendance and open advances.
    Returns list of warning messages (e.g. excluded unlocked records, workers without daily rate).
    """
    if run.status != PayrollRunStatus.DRAFT:
        raise BusinessRuleError(
            "Only DRAFT payroll runs can be recalculated.",
            code="invalid_status",
        )

    org = run.organization
    warnings = []

    # Check for unlocked records in the period
    unlocked_count = Attendance.objects.filter(
        organization=org,
        project=run.project,
        date__gte=run.period_start,
        date__lte=run.period_end,
        is_locked=False,
    ).count()
    if unlocked_count > 0:
        warnings.append(
            f"{unlocked_count} unlocked attendance records in the period were excluded. Only locked attendance is processed."
        )

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
                continue  # Workers with no locked attendance in the period get no voucher

            if emp.effective_daily_rate <= Decimal("0.00"):
                warnings.append(
                    f"Worker {emp.full_name} ({emp.employee_code}) has a daily rate of 0.00."
                )

            # Calculate open advances for this worker
            open_adv = Decimal("0.00")
            for adv in Advance.objects.filter(
                employee=emp,
                status__in=[AdvanceStatus.OPEN, AdvanceStatus.PARTIALLY_ADJUSTED],
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

    return warnings


def update_voucher(voucher: PayrollVoucher, user: User, data: dict) -> PayrollVoucher:
    """
    PATCH payroll/vouchers/{id}:
    Allowed in DRAFT run only: advances_deducted (<= open advances and <= gross) and payment_mode.
    """
    if voucher.run.status != PayrollRunStatus.DRAFT:
        raise BusinessRuleError(
            "Can only edit vouchers in a DRAFT payroll run.",
            code="invalid_status",
        )

    update_fields = ["updated_at"]

    if "advances_deducted" in data:
        new_ded = q2(data["advances_deducted"])
        if new_ded < Decimal("0.00"):
            raise BusinessRuleError("Deduction cannot be negative.", code="invalid_deduction")
        if new_ded > voucher.gross_pay:
            raise BusinessRuleError(
                f"Advances deducted ({new_ded}) cannot exceed gross pay ({voucher.gross_pay}).",
                code="deduction_exceeds_gross",
            )

        # Check worker's total open advances
        total_open = sum(
            adv.remaining_amount
            for adv in Advance.objects.filter(
                employee=voucher.employee,
                status__in=[AdvanceStatus.OPEN, AdvanceStatus.PARTIALLY_ADJUSTED],
            )
        )
        if new_ded > total_open:
            raise BusinessRuleError(
                f"Advances deducted ({new_ded}) cannot exceed open advances ({total_open}).",
                code="deduction_exceeds_open",
            )

        voucher.advances_deducted = new_ded
        voucher.net_pay = q2(voucher.gross_pay - new_ded)
        update_fields.extend(["advances_deducted", "net_pay"])

    if "payment_mode" in data and data["payment_mode"]:
        voucher.payment_mode = data["payment_mode"]
        update_fields.append("payment_mode")

    voucher.save(update_fields=update_fields)

    # Recalculate run totals
    run = voucher.run
    run.total_advances = sum(v.advances_deducted for v in run.vouchers.all())
    run.total_net = sum(v.net_pay for v in run.vouchers.all())
    run.save(update_fields=["total_advances", "total_net", "updated_at"])

    return voucher


def approve_run(run: PayrollRun, approver: User, request=None) -> PayrollRun:
    """
    UC-25: Approve payroll run.
    - Creator cannot approve their own payroll run (segregation of duties).
    - Consumes worker advances FIFO.
    - Balanced ledger posting:
        DR 5005 Wages Expense = total_gross
        CR 1100 Worker Advances = total_advances
        CR 1001 Cash = cash_net
        CR 1002 Bank = bank_net
    - Increments project actual_spend by total_gross.
    - Audited under PAYROLL_APPROVED.
    """
    if run.status != PayrollRunStatus.DRAFT:
        raise BusinessRuleError("Only DRAFT payroll runs can be approved.", code="invalid_status")

    if run.created_by_id == approver.id:
        raise BusinessRuleError(
            "Segregation of duties: Creator cannot approve their own payroll run.",
            code="self_approval_blocked",
        )

    org = run.organization

    with transaction.atomic():
        # 1. Consume worker advances FIFO
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

        # 2. Determine net cash vs bank totals
        cash_net = Decimal("0.00")
        bank_net = Decimal("0.00")
        for v in run.vouchers.all():
            if v.payment_mode == "CASH":
                cash_net += v.net_pay
            else:
                bank_net += v.net_pay

        # 3. Double-entry ledger lines
        lines = [
            {
                "account_code": "5005",
                "side": "DR",
                "amount": run.total_gross,
                "memo": f"Wages expense for Payroll Run #{run.id}",
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

        log_action(
            user=approver,
            action=AuditAction.PAYROLL_APPROVED,
            obj=run,
            changes={"status": PayrollRunStatus.APPROVED, "total_gross": str(run.total_gross)},
            request=request,
            organization=org,
        )

    return run


def cancel_run(run: PayrollRun, user: User, reason: str, request=None) -> PayrollRun:
    """
    UC-25: Cancel a payroll run.
    - If DRAFT: cancels directly.
    - If APPROVED: allowed only if no voucher has been paid.
      Reverses journal, reverses project spend, and restores consumed advances.
    - If already PAID or vouchers paid: strictly blocked.
    - Audited under PAYROLL_CANCELLED.
    """
    if run.status == PayrollRunStatus.CANCELLED:
        raise BusinessRuleError("Payroll run is already cancelled.", code="already_cancelled")

    if (
        run.status == PayrollRunStatus.PAID
        or run.vouchers.filter(status=VoucherStatus.PAID).exists()
    ):
        raise BusinessRuleError(
            "Cannot cancel payroll run because one or more vouchers are already paid.",
            code="cannot_cancel",
        )

    if run.status not in [PayrollRunStatus.DRAFT, PayrollRunStatus.APPROVED]:
        raise BusinessRuleError(
            f"Cannot cancel payroll run in {run.status} status.",
            code="invalid_status",
        )

    if run.status == PayrollRunStatus.APPROVED:
        with transaction.atomic():
            # 1. Reverse journal entry
            if run.journal_entry:
                reverse_entry(
                    run.journal_entry,
                    user=user,
                    reason=f"Cancelled Payroll #{run.id}: {reason}",
                )

            # 2. Reverse project spend
            update_spend(run.project, -run.total_gross, reason=f"Cancelled Payroll #{run.id}")

            # 3. Restore advances
            for voucher in run.vouchers.all():
                deduction_to_restore = voucher.advances_deducted
                if deduction_to_restore > Decimal("0.00"):
                    adjusted_advances = Advance.objects.filter(
                        employee=voucher.employee,
                        adjusted_amount__gt=Decimal("0.00"),
                    ).order_by("-advance_date", "-id")

                    for adv in adjusted_advances:
                        if deduction_to_restore <= Decimal("0.00"):
                            break
                        already_adjusted = adv.adjusted_amount
                        if already_adjusted <= deduction_to_restore:
                            adv.adjusted_amount = Decimal("0.00")
                            adv.status = AdvanceStatus.OPEN
                            deduction_to_restore -= already_adjusted
                        else:
                            adv.adjusted_amount -= deduction_to_restore
                            adv.status = AdvanceStatus.PARTIALLY_ADJUSTED
                            deduction_to_restore = Decimal("0.00")
                        adv.save(update_fields=["adjusted_amount", "status", "updated_at"])

            run.status = PayrollRunStatus.CANCELLED
            run.notes = f"Cancelled: {reason}"
            run.save(update_fields=["status", "notes", "updated_at"])

            log_action(
                user=user,
                action=AuditAction.PAYROLL_CANCELLED,
                obj=run,
                changes={"status": PayrollRunStatus.CANCELLED, "reason": reason},
                request=request,
                organization=run.organization,
            )
    else:
        run.status = PayrollRunStatus.CANCELLED
        run.notes = f"Cancelled: {reason}"
        run.save(update_fields=["status", "notes", "updated_at"])

    return run


def mark_voucher_paid(
    voucher: PayrollVoucher,
    user: User,
    reference: str = "",
    request=None,
) -> PayrollVoucher:
    """
    UC-25: Mark an individual voucher as PAID.
    When all vouchers in the run are paid, the PayrollRun status transitions to PAID.
    """
    if voucher.run.status != PayrollRunStatus.APPROVED:
        raise BusinessRuleError(
            "Vouchers can only be marked paid after the payroll run is APPROVED.",
            code="invalid_status",
        )

    with transaction.atomic():
        voucher.status = VoucherStatus.PAID
        voucher.paid_at = timezone.now()
        voucher.payment_reference = reference
        voucher.save(update_fields=["status", "paid_at", "payment_reference", "updated_at"])

        # Check if all vouchers in run are now paid
        run = voucher.run
        if not run.vouchers.filter(status=VoucherStatus.PENDING).exists():
            run.status = PayrollRunStatus.PAID
            run.save(update_fields=["status", "updated_at"])

        log_action(
            user=user,
            action=AuditAction.VOUCHER_PAID,
            obj=voucher,
            changes={"voucher_number": voucher.voucher_number, "net_pay": str(voucher.net_pay)},
            request=request,
            organization=voucher.organization,
        )

    return voucher


def generate_voucher_pdf(voucher: PayrollVoucher) -> bytes:
    """
    UC-25: Generate a professional printable wage voucher PDF using ReportLab.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=142,
        bottomMargin=65,
    )
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "VoucherTitle",
        parent=styles["Heading1"],
        fontSize=18,
        leading=22,
        alignment=1,  # Center
        textColor=colors.HexColor("#1A365D"),
    )
    subtitle_style = ParagraphStyle(
        "VoucherSubTitle",
        parent=styles["Normal"],
        fontSize=11,
        leading=14,
        alignment=1,
        textColor=colors.HexColor("#4A5568"),
    )
    normal_style = styles["Normal"]
    bold_style = ParagraphStyle("VoucherBold", parent=styles["Normal"], fontName="Helvetica-Bold")

    elements = []

    # 1. Header
    org_name = (
        voucher.organization.name if voucher.organization else "BuildSphere AI"
    )
    elements.append(Paragraph(org_name, title_style))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("OFFICIAL WORKER WAGE VOUCHER", subtitle_style))
    elements.append(Spacer(1, 14))

    # 2. Meta Information Table
    run = voucher.run
    emp = voucher.employee
    meta_data = [
        [
            Paragraph(f"<b>Voucher No:</b> {voucher.voucher_number}", normal_style),
            Paragraph(f"<b>Date:</b> {run.period_end}", normal_style),
        ],
        [
            Paragraph(f"<b>Project:</b> {run.project.name} ({run.project.code})", normal_style),
            Paragraph(f"<b>Pay Period:</b> {run.period_start} to {run.period_end}", normal_style),
        ],
        [
            Paragraph(f"<b>Worker Name:</b> {emp.full_name}", normal_style),
            Paragraph(f"<b>Worker Code:</b> {emp.employee_code}", normal_style),
        ],
        [
            Paragraph(f"<b>Trade:</b> {emp.trade}", normal_style),
            Paragraph(f"<b>Payment Mode:</b> {voucher.payment_mode}", normal_style),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[270, 270])
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F7FAFC")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E0")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("PADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements.append(meta_table)
    elements.append(Spacer(1, 14))

    # 3. Attendance Summary Table
    att_data = [
        ["Days Present", "Half Days", "Paid Holidays", "Overtime (Hrs)"],
        [
            str(voucher.days_present),
            str(voucher.half_days),
            str(voucher.paid_holidays),
            f"{voucher.ot_hours} hrs",
        ],
    ]
    att_table = Table(att_data, colWidths=[135, 135, 135, 135])
    att_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EDF2F7")),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E0")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("PADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    elements.append(Paragraph("<b>Attendance Record</b>", bold_style))
    elements.append(Spacer(1, 4))
    elements.append(att_table)
    elements.append(Spacer(1, 14))

    # 4. Earnings & Deductions Breakdown
    wage_data = [
        ["Description", "Rate", "Quantity / Factor", "Amount (INR)"],
        [
            "Basic Wage",
            f"{voucher.daily_rate_used}/day",
            f"{voucher.days_present + (0.5 * voucher.half_days) + voucher.paid_holidays} units",
            f"{voucher.basic_pay}",
        ],
        [
            "Overtime Pay",
            f"{voucher.ot_rate_used}/hr",
            f"{voucher.ot_hours} hrs",
            f"{voucher.ot_pay}",
        ],
        ["TOTAL GROSS WAGE", "", "", f"{voucher.gross_pay}"],
        ["Less: Worker Advance Deduction", "", "", f"-{voucher.advances_deducted}"],
        ["NET AMOUNT PAYABLE", "", "", f"{voucher.net_pay}"],
    ]
    wage_table = Table(wage_data, colWidths=[200, 110, 110, 120])
    wage_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2B6CB0")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ALIGN", (3, 0), (3, -1), "RIGHT"),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E0")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("BACKGROUND", (0, 3), (-1, 3), colors.HexColor("#EDF2F7")),
                ("FONTNAME", (0, 3), (-1, 3), "Helvetica-Bold"),
                ("BACKGROUND", (0, 5), (-1, 5), colors.HexColor("#C6F6D5")),
                ("FONTNAME", (0, 5), (-1, 5), "Helvetica-Bold"),
                ("TEXTCOLOR", (0, 5), (-1, 5), colors.HexColor("#22543D")),
                ("PADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements.append(Paragraph("<b>Wage Statement & Deductions</b>", bold_style))
    elements.append(Spacer(1, 4))
    elements.append(wage_table)
    elements.append(Spacer(1, 30))

    # 5. Signature Lines
    sig_data = [
        [
            "___________________________",
            "___________________________",
            "___________________________",
        ],
        [
            "Prepared By (Supervisor)",
            "Verified By (Accountant / PM)",
            "Worker Signature / Thumb",
        ],
    ]
    sig_table = Table(sig_data, colWidths=[180, 180, 180])
    sig_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 1), (-1, 1), "Helvetica"),
                ("FONTSIZE", (0, 1), (-1, 1), 9),
                ("TEXTCOLOR", (0, 1), (-1, 1), colors.HexColor("#4A5568")),
                ("PADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    elements.append(sig_table)

    doc.build(
        elements,
        onFirstPage=draw_letterhead_background,
        onLaterPages=draw_letterhead_background,
    )
    pdf_bytes = buf.getvalue()
    buf.close()
    return pdf_bytes
