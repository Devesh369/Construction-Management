"""
Tests for Payroll services, pure calculations, FIFO advance deduction, and PDF export (Phase P6).
Verifies UC-23, UC-24, UC-25, and rules from Section 6 and Section 7.2.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from accounts.services import accept_invitation, create_organization, create_user_invitation
from attendance.models import Attendance, AttendanceStatus
from attendance.services import AttendanceSummary
from audit.constants import AuditAction
from audit.models import AuditLog
from core.exceptions import BusinessRuleError
from core.roles import Role
from payroll.models import (
    AdvanceStatus,
    PayrollRunStatus,
    VoucherStatus,
)
from payroll.services import (
    approve_run,
    calculate_voucher,
    cancel_run,
    create_run,
    generate_voucher_pdf,
    mark_voucher_paid,
    record_advance,
    update_voucher,
)
from projects.services import create_project
from workforce.services import create_employee


@pytest.mark.django_db
class TestPayrollServices:
    def setup_method(self):
        # 1. Tenant organization
        self.org, self.invite, self.token = create_organization(
            "Alpha Infra Ltd", "admin@alphainfra.test"
        )
        self.admin, _ = accept_invitation(self.token, "AdminPass123#", "Admin Alpha")

        # 2. Team: Accountant & PM
        acc_inv, acc_tok = create_user_invitation(
            self.org, "acc@alphainfra.test", Role.ACCOUNTANT, self.admin
        )
        self.acc, _ = accept_invitation(acc_tok, "AccPass123#", "Accountant Alpha")

        pm_inv, pm_tok = create_user_invitation(
            self.org, "pm@alphainfra.test", Role.PROJECT_MANAGER, self.admin
        )
        self.pm, _ = accept_invitation(pm_tok, "PMPass123#", "PM Alpha")

        # 3. Project
        self.project = create_project(
            self.org,
            user=self.admin,
            data={
                "name": "Skyline Project",
                "code": "SKY-P6",
                "budget": Decimal("50000000.00"),
            },
        )

        # 4. Workers
        self.worker1 = create_employee(
            self.org,
            data={
                "full_name": "Ramesh Carpenter",
                "trade": "CARPENTER",
                "employment_type": "DAILY_WAGE",
                "daily_rate": Decimal("800.00"),
                "ot_hourly_rate": Decimal("100.00"),
                "upi_id": "ramesh@okaxis",
                "primary_project": self.project,
            },
            user=self.admin,
        )

        self.worker2 = create_employee(
            self.org,
            data={
                "full_name": "Suresh Mason",
                "trade": "MASON",
                "employment_type": "DAILY_WAGE",
                "daily_rate": Decimal("900.00"),
                "ot_hourly_rate": Decimal("120.00"),
                "bank_account_number": "123456789012",
                "bank_ifsc": "SBIN0001234",
                "primary_project": self.project,
            },
            user=self.admin,
        )

    def test_calculate_voucher_worked_example_and_edge_cases(self):
        """
        Verify wage formula matching worked example:
        Rate 800, OT 100.
        5 present, 1 half day, 1 holiday, 6 OT hrs, 1000 advance.
        basic: (5 + 0.5 + 1) * 800 = 5200.00
        ot: 6 * 100 = 600.00
        gross: 5800.00
        net: 4800.00
        """
        summary = AttendanceSummary(
            employee_id=self.worker1.id,
            days_present=5,
            half_days=1,
            paid_holidays=1,
            ot_hours=Decimal("6.00"),
        )
        calc = calculate_voucher(
            self.worker1, summary, open_advances=Decimal("1000.00"), org=self.org
        )
        assert calc["basic_pay"] == Decimal("5200.00")
        assert calc["ot_pay"] == Decimal("600.00")
        assert calc["gross_pay"] == Decimal("5800.00")
        assert calc["advances_deducted"] == Decimal("1000.00")
        assert calc["net_pay"] == Decimal("4800.00")
        assert calc["payment_mode"] == "UPI"

        # Edge case 1: Half days only (3 half days @ 800) -> units = 1.5 -> 1200.00
        sum_half = AttendanceSummary(
            employee_id=self.worker1.id,
            days_present=0,
            half_days=3,
            paid_holidays=0,
            ot_hours=Decimal("0.00"),
        )
        calc_half = calculate_voucher(
            self.worker1, sum_half, open_advances=Decimal("0.00"), org=self.org
        )
        assert calc_half["basic_pay"] == Decimal("1200.00")
        assert calc_half["gross_pay"] == Decimal("1200.00")
        assert calc_half["net_pay"] == Decimal("1200.00")

        # Edge case 2: Open advances exceed gross pay -> deduction capped at gross, net = 0
        calc_over_adv = calculate_voucher(
            self.worker1, sum_half, open_advances=Decimal("5000.00"), org=self.org
        )
        assert calc_over_adv["advances_deducted"] == Decimal("1200.00")
        assert calc_over_adv["net_pay"] == Decimal("0.00")

    def test_record_advance_cash_and_bank(self):
        """Worker advances create OPEN record and post DR 1100 / CR 1001 or 1002."""
        adv_cash = record_advance(
            user=self.pm,
            data={
                "employee": self.worker1,
                "project": self.project,
                "amount": Decimal("1500.00"),
                "advance_date": date(2026, 10, 1),
                "payment_mode": "CASH",
                "reason": "Festival advance",
            },
        )
        assert adv_cash.status == AdvanceStatus.OPEN
        assert adv_cash.remaining_amount == Decimal("1500.00")
        assert adv_cash.journal_entry is not None

        # Check journal: DR 1100 / CR 1001
        lines = list(adv_cash.journal_entry.lines.all())
        dr = [ln for ln in lines if ln.side == "DR"][0]
        cr = [ln for ln in lines if ln.side == "CR"][0]
        assert dr.account.code == "1100"
        assert dr.amount == Decimal("1500.00")
        assert cr.account.code == "1001"
        assert cr.amount == Decimal("1500.00")

        # Audit log written
        assert AuditLog.objects.filter(
            organization=self.org, action=AuditAction.ADVANCE_GIVEN, resource_id=adv_cash.id
        ).exists()

    def test_create_run_period_validations_and_overlap_block(self):
        """Validates date period: end >= start, end <= today, no overlapping active runs."""
        today = timezone.localdate()
        p_start = today - timedelta(days=14)
        p_end = today - timedelta(days=7)

        # 1. Invalid date range (end < start)
        with pytest.raises(BusinessRuleError, match="cannot be earlier than start date"):
            create_run(self.acc, self.project, period_start=p_end, period_end=p_start)

        # 2. Future date
        with pytest.raises(BusinessRuleError, match="cannot be in the future"):
            create_run(
                self.acc, self.project, period_start=today, period_end=today + timedelta(days=5)
            )

        # 3. Create successful DRAFT run
        run, _ = create_run(self.acc, self.project, period_start=p_start, period_end=p_end)
        assert run.status == PayrollRunStatus.DRAFT

        # 4. Overlapping run attempt for same project -> blocked
        with pytest.raises(BusinessRuleError, match="overlapping period already exists"):
            create_run(
                self.acc,
                self.project,
                period_start=p_start + timedelta(days=2),
                period_end=p_end + timedelta(days=2),
            )

    def test_only_locked_attendance_used_and_warnings_reported(self):
        """Unlocked attendance is excluded from payroll and flagged in warnings."""
        p_start = date(2026, 10, 1)
        p_end = date(2026, 10, 5)

        # Worker 1: 3 locked records, 2 unlocked records
        for d in [date(2026, 10, 1), date(2026, 10, 2), date(2026, 10, 3)]:
            Attendance.objects.create(
                organization=self.org,
                employee=self.worker1,
                project=self.project,
                date=d,
                status=AttendanceStatus.PRESENT,
                is_locked=True,
                marked_by=self.pm,
            )
        for d in [date(2026, 10, 4), date(2026, 10, 5)]:
            Attendance.objects.create(
                organization=self.org,
                employee=self.worker1,
                project=self.project,
                date=d,
                status=AttendanceStatus.PRESENT,
                is_locked=False,
                marked_by=self.pm,
            )

        run, warnings = create_run(self.acc, self.project, period_start=p_start, period_end=p_end)
        assert run.status == PayrollRunStatus.DRAFT
        assert any("unlocked attendance records" in w for w in warnings)

        # Voucher for Worker 1 only counts 3 days
        vouchers = list(run.vouchers.filter(employee=self.worker1))
        assert len(vouchers) == 1
        v = vouchers[0]
        assert v.days_present == 3
        # 3 * 800 = 2400.00
        assert v.basic_pay == Decimal("2400.00")
        assert v.gross_pay == Decimal("2400.00")

    def test_fifo_advance_deduction_and_approval_settlement(self):
        """Advances are adjusted oldest-first (FIFO); balanced journal posted; spend updated."""
        p_start = date(2026, 10, 1)
        p_end = date(2026, 10, 6)

        # Attendance: 6 locked days present for Worker 1 (6 * 800 = 4800 gross)
        for i in range(1, 7):
            Attendance.objects.create(
                organization=self.org,
                employee=self.worker1,
                project=self.project,
                date=date(2026, 10, i),
                status=AttendanceStatus.PRESENT,
                is_locked=True,
                marked_by=self.pm,
            )

        # Worker 1 has two advances:
        # Adv 1: 1000.00 on Oct 1
        # Adv 2: 1500.00 on Oct 2
        adv1 = record_advance(
            user=self.pm,
            data={
                "employee": self.worker1,
                "project": self.project,
                "amount": Decimal("1000.00"),
                "advance_date": date(2026, 10, 1),
            },
        )
        adv2 = record_advance(
            user=self.pm,
            data={
                "employee": self.worker1,
                "project": self.project,
                "amount": Decimal("1500.00"),
                "advance_date": date(2026, 10, 2),
            },
        )

        run, _ = create_run(self.acc, self.project, period_start=p_start, period_end=p_end)
        voucher = run.vouchers.get(employee=self.worker1)
        # Gross = 4800.00, Advances = 2500.00, Net = 2300.00 (via UPI)
        assert voucher.gross_pay == Decimal("4800.00")
        assert voucher.advances_deducted == Decimal("2500.00")
        assert voucher.net_pay == Decimal("2300.00")
        assert voucher.payment_mode == "UPI"

        initial_spend = self.project.actual_spend

        # Segregation of duties: Creator (acc) cannot approve own run
        with pytest.raises(BusinessRuleError, match="Creator cannot approve their own"):
            approve_run(run, approver=self.acc)

        # Admin approves
        approved = approve_run(run, approver=self.admin)
        assert approved.status == PayrollRunStatus.APPROVED
        assert approved.journal_entry is not None

        # Verify advances FIFO adjustment
        adv1.refresh_from_db()
        adv2.refresh_from_db()
        assert adv1.status == AdvanceStatus.ADJUSTED
        assert adv1.adjusted_amount == Decimal("1000.00")
        assert adv2.status == AdvanceStatus.ADJUSTED
        assert adv2.adjusted_amount == Decimal("1500.00")

        # Verify balanced journal entry:
        # DR 5005 (Wages) = 4800.00
        # CR 1100 (Advances) = 2500.00
        # CR 1002 (Bank) = 2300.00
        lines = list(approved.journal_entry.lines.all())
        dr_wages = [ln for ln in lines if ln.account.code == "5005"][0]
        cr_adv = [ln for ln in lines if ln.account.code == "1100"][0]
        cr_bank = [ln for ln in lines if ln.account.code == "1002"][0]
        assert dr_wages.amount == Decimal("4800.00")
        assert cr_adv.amount == Decimal("2500.00")
        assert cr_bank.amount == Decimal("2300.00")

        # Project spend updated by total gross
        self.project.refresh_from_db()
        assert self.project.actual_spend == initial_spend + Decimal("4800.00")

    def test_cancel_run_reverses_journal_spend_and_restores_advances(self):
        """Cancelling approved run reverses journal, decreases spend, and restores advances."""
        p_start = date(2026, 10, 1)
        p_end = date(2026, 10, 5)

        for i in range(1, 6):
            Attendance.objects.create(
                organization=self.org,
                employee=self.worker1,
                project=self.project,
                date=date(2026, 10, i),
                status=AttendanceStatus.PRESENT,
                is_locked=True,
                marked_by=self.pm,
            )

        adv = record_advance(
            user=self.pm,
            data={
                "employee": self.worker1,
                "project": self.project,
                "amount": Decimal("1000.00"),
                "advance_date": date(2026, 10, 1),
            },
        )

        run, _ = create_run(self.acc, self.project, period_start=p_start, period_end=p_end)
        approve_run(run, approver=self.admin)
        self.project.refresh_from_db()
        spend_after_appr = self.project.actual_spend

        adv.refresh_from_db()
        assert adv.status == AdvanceStatus.ADJUSTED

        # Cancel run
        cancelled = cancel_run(run, user=self.admin, reason="Accounting correction")
        assert cancelled.status == PayrollRunStatus.CANCELLED

        # Project spend reversed
        self.project.refresh_from_db()
        assert self.project.actual_spend == spend_after_appr - run.total_gross

        # Advance restored
        adv.refresh_from_db()
        assert adv.status == AdvanceStatus.OPEN
        assert adv.adjusted_amount == Decimal("0.00")

    def test_mark_voucher_paid_and_run_status_progression(self):
        """Marking all vouchers paid transitions the payroll run status to PAID."""
        p_start = date(2026, 10, 1)
        p_end = date(2026, 10, 3)

        for i in range(1, 4):
            Attendance.objects.create(
                organization=self.org,
                employee=self.worker1,
                project=self.project,
                date=date(2026, 10, i),
                status=AttendanceStatus.PRESENT,
                is_locked=True,
                marked_by=self.pm,
            )

        run, _ = create_run(self.acc, self.project, period_start=p_start, period_end=p_end)

        # Attempting mark paid on DRAFT run is rejected
        vch = run.vouchers.first()
        with pytest.raises(BusinessRuleError, match="only be marked paid after.*APPROVED"):
            mark_voucher_paid(vch, user=self.admin)

        approve_run(run, approver=self.admin)
        vch.refresh_from_db()

        # Mark paid
        paid_vch = mark_voucher_paid(vch, user=self.admin, reference="UPI-REF-998877")
        assert paid_vch.status == VoucherStatus.PAID
        assert paid_vch.payment_reference == "UPI-REF-998877"

        # Run becomes PAID since all vouchers are paid
        run.refresh_from_db()
        assert run.status == PayrollRunStatus.PAID

        # Cancellation after payout is strictly blocked
        with pytest.raises(BusinessRuleError, match="one or more vouchers are already paid"):
            cancel_run(run, user=self.admin, reason="Cannot cancel paid run")

    def test_update_draft_voucher_deduction_and_payment_mode(self):
        """Can adjust deductions and payment mode in a DRAFT run."""
        p_start = date(2026, 10, 1)
        p_end = date(2026, 10, 5)

        for i in range(1, 6):
            Attendance.objects.create(
                organization=self.org,
                employee=self.worker1,
                project=self.project,
                date=date(2026, 10, i),
                status=AttendanceStatus.PRESENT,
                is_locked=True,
                marked_by=self.pm,
            )

        record_advance(
            user=self.pm,
            data={
                "employee": self.worker1,
                "project": self.project,
                "amount": Decimal("1000.00"),
                "advance_date": date(2026, 10, 1),
            },
        )

        run, _ = create_run(self.acc, self.project, period_start=p_start, period_end=p_end)
        vch = run.vouchers.first()
        assert vch.advances_deducted == Decimal("1000.00")

        # Reduce deduction to 500.00
        updated = update_voucher(
            vch,
            user=self.acc,
            data={"advances_deducted": Decimal("500.00"), "payment_mode": "CASH"},
        )
        assert updated.advances_deducted == Decimal("500.00")
        assert updated.net_pay == updated.gross_pay - Decimal("500.00")
        assert updated.payment_mode == "CASH"

        # Exceeding open advances (1500 > 1000) raises error
        with pytest.raises(BusinessRuleError, match="cannot exceed open advances"):
            update_voucher(vch, user=self.acc, data={"advances_deducted": Decimal("1500.00")})

    def test_generate_voucher_pdf(self):
        """ReportLab generates a valid PDF byte string."""
        p_start = date(2026, 10, 1)
        p_end = date(2026, 10, 3)

        for i in range(1, 4):
            Attendance.objects.create(
                organization=self.org,
                employee=self.worker1,
                project=self.project,
                date=date(2026, 10, i),
                status=AttendanceStatus.PRESENT,
                is_locked=True,
                marked_by=self.pm,
            )

        run, _ = create_run(self.acc, self.project, period_start=p_start, period_end=p_end)
        vch = run.vouchers.first()
        pdf_bytes = generate_voucher_pdf(vch)
        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 500
        # Standard PDF magic header
        assert pdf_bytes.startswith(b"%PDF")
