"""
Unit tests for Reports generation services (Phase P7: Insight).
Tests PDF structure (starts with %PDF), Excel sheet headers/totals via openpyxl, row limits, and multi-tenancy.
"""

from datetime import date
from decimal import Decimal
from unittest.mock import patch

import openpyxl
import pytest
from accounts.services import (
    accept_invitation,
    create_organization,
    create_user_invitation,
)
from attendance.models import Attendance, AttendanceStatus
from core.exceptions import RowLimitExceededError
from core.roles import Role
from expenses.models import Expense, ExpenseCategory, ExpenseStatus, PaymentMode
from ledger.models import Side
from ledger.services import post_journal_entry
from payroll.models import PayrollRun, PayrollRunStatus, PayrollVoucher
from progress.models import DailyProgressReport, DPRStatus, MaterialUsage, TaskProgress
from projects.models import ProjectStatus
from projects.services import create_project
from workforce.services import create_employee

from reports.services import (
    generate_attendance_excel,
    generate_dpr_excel,
    generate_expenses_excel,
    generate_payroll_pdf,
    generate_profit_loss_pdf,
    generate_trial_balance_pdf,
)


@pytest.mark.django_db
class TestReportsServices:
    def setup_method(self):
        # Organization Alpha
        self.org, _, self.token = create_organization("Apex Infra Ltd", "admin@apex.test")
        self.admin, _ = accept_invitation(self.token, "AdminPass123#", "Admin Apex")

        pm_inv, pm_tok = create_user_invitation(
            self.org, "pm@apex.test", Role.PROJECT_MANAGER, self.admin
        )
        self.pm, _ = accept_invitation(pm_tok, "PMPass123#", "PM Apex")

        self.project = create_project(
            self.org,
            self.admin,
            {"name": "Metro Bridge", "code": "MB-01", "estimated_budget": Decimal("500000.00")},
        )
        self.project.status = ProjectStatus.ACTIVE
        self.project.save()

        self.emp1 = create_employee(
            self.org,
            {
                "full_name": "Vijay Verma",
                "employee_code": "EMP-101",
                "daily_rate": Decimal("850.00"),
                "trade": "WELDER",
            },
            self.admin,
        )

    def test_payroll_pdf_generation(self):
        # Create payroll run and voucher
        run = PayrollRun.objects.create(
            organization=self.org,
            project=self.project,
            period_start=date(2026, 10, 1),
            period_end=date(2026, 10, 7),
            total_gross=Decimal("5100.00"),
            total_net=Decimal("5100.00"),
            status=PayrollRunStatus.APPROVED,
            created_by=self.admin,
        )
        PayrollVoucher.objects.create(
            organization=self.org,
            run=run,
            employee=self.emp1,
            voucher_number="VCH-1001",
            days_present=6,
            half_days=0,
            ot_hours=Decimal("4.00"),
            basic_pay=Decimal("5100.00"),
            ot_pay=Decimal("400.00"),
            gross_pay=Decimal("5500.00"),
            advances_deducted=Decimal("400.00"),
            net_pay=Decimal("5100.00"),
        )

        buffer, count = generate_payroll_pdf(
            org=self.org,
            user=self.admin,
            project_id=self.project.id,
            period_start=date(2026, 10, 1),
            period_end=date(2026, 10, 7),
        )

        pdf_bytes = buffer.getvalue()
        assert count == 1
        assert pdf_bytes.startswith(b"%PDF")
        assert len(pdf_bytes) > 500

    def test_dpr_excel_generation(self):
        dpr = DailyProgressReport.objects.create(
            organization=self.org,
            project=self.project,
            report_date=date(2026, 10, 5),
            summary="Completed pier 4 concrete pouring",
            weather="Sunny 32C",
            issues="None",
            status=DPRStatus.VERIFIED,
            submitted_by=self.admin,
            verified_by=self.admin,
        )
        TaskProgress.objects.create(
            organization=self.org,
            report=dpr,
            task_name="Pier 4 Concreting",
            percent_complete=Decimal("100.00"),
            notes="Done ahead of schedule",
        )
        MaterialUsage.objects.create(
            organization=self.org,
            report=dpr,
            material_name="RMC M35",
            quantity=Decimal("45.500"),
            unit="cum",
        )

        buffer, count = generate_dpr_excel(
            org=self.org,
            user=self.admin,
            project_id=self.project.id,
            date_from=date(2026, 10, 1),
            date_to=date(2026, 10, 10),
        )

        assert count == 1
        wb = openpyxl.load_workbook(buffer)
        assert "DPR Summary Log" in wb.sheetnames
        assert "Tasks & Materials" in wb.sheetnames

        ws1 = wb["DPR Summary Log"]
        assert ws1.cell(row=5, column=2).value == "MB-01"
        assert ws1.cell(row=5, column=4).value == "VERIFIED"

        ws2 = wb["Tasks & Materials"]
        assert ws2.cell(row=5, column=4).value == "Pier 4 Concreting"
        assert ws2.cell(row=6, column=4).value == "RMC M35"

    def test_expenses_excel_generation(self):
        Expense.objects.create(
            organization=self.org,
            project=self.project,
            category=ExpenseCategory.MATERIAL,
            description="Steel reinforcement bars",
            amount=Decimal("45000.00"),
            expense_date=date(2026, 10, 2),
            payment_mode=PaymentMode.BANK_TRANSFER,
            status=ExpenseStatus.APPROVED,
            created_by=self.admin,
            approved_by=self.admin,
        )
        Expense.objects.create(
            organization=self.org,
            project=self.project,
            category=ExpenseCategory.FUEL,
            description="Excavator diesel refill",
            amount=Decimal("12500.00"),
            expense_date=date(2026, 10, 3),
            payment_mode=PaymentMode.CASH,
            status=ExpenseStatus.APPROVED,
            created_by=self.admin,
            approved_by=self.admin,
        )

        buffer, count = generate_expenses_excel(
            org=self.org,
            user=self.admin,
            project_id=self.project.id,
            date_from=date(2026, 10, 1),
            date_to=date(2026, 10, 10),
        )

        assert count == 2
        wb = openpyxl.load_workbook(buffer)
        ws = wb.active
        assert ws.title == "Expense Ledger"
        # Total row is row 7 (headers at 4, rows at 5 and 6)
        assert ws.cell(row=7, column=1).value == "TOTAL"
        # Total amount = 45000 + 12500 = 57500.00
        assert ws.cell(row=7, column=6).value == 57500.00

    def test_attendance_excel_generation(self):
        Attendance.objects.create(
            organization=self.org,
            project=self.project,
            employee=self.emp1,
            date=date(2026, 10, 1),
            status=AttendanceStatus.PRESENT,
            ot_hours=Decimal("2.50"),
            marked_by=self.admin,
        )
        Attendance.objects.create(
            organization=self.org,
            project=self.project,
            employee=self.emp1,
            date=date(2026, 10, 2),
            status=AttendanceStatus.HALF_DAY,
            ot_hours=Decimal("0.00"),
            marked_by=self.admin,
        )

        buffer, count = generate_attendance_excel(
            org=self.org,
            user=self.admin,
            project_id=self.project.id,
            date_from=date(2026, 10, 1),
            date_to=date(2026, 10, 5),
        )

        assert count == 2
        wb = openpyxl.load_workbook(buffer)
        assert "Muster Roll Summary" in wb.sheetnames
        assert "Daily Attendance Records" in wb.sheetnames

        ws1 = wb["Muster Roll Summary"]
        assert ws1.cell(row=5, column=1).value == "EMP-101"
        assert ws1.cell(row=5, column=4).value == 1  # 1 present
        assert ws1.cell(row=5, column=5).value == 1  # 1 half day
        assert ws1.cell(row=5, column=7).value == 2.50  # 2.5 OT hours

    def test_profit_loss_pdf_generation(self):
        post_journal_entry(
            org=self.org,
            date=date(2026, 10, 4),
            description="Client billing & Site supplies",
            lines=[
                {"account_code": "1200", "side": Side.DR, "amount": "150000.00"},
                {"account_code": "4001", "side": Side.CR, "amount": "150000.00"},  # Revenue
                {"account_code": "5001", "side": Side.DR, "amount": "40000.00"},  # Expense
                {"account_code": "1001", "side": Side.CR, "amount": "40000.00"},
            ],
            user=self.admin,
        )

        buffer, count = generate_profit_loss_pdf(
            org=self.org,
            user=self.admin,
            date_from=date(2026, 10, 1),
            date_to=date(2026, 10, 10),
        )

        pdf_bytes = buffer.getvalue()
        assert pdf_bytes.startswith(b"%PDF")
        assert len(pdf_bytes) > 500

    def test_trial_balance_pdf_generation(self):
        post_journal_entry(
            org=self.org,
            date=date(2026, 10, 1),
            description="Opening capital",
            lines=[
                {"account_code": "1001", "side": Side.DR, "amount": "200000.00"},
                {"account_code": "3001", "side": Side.CR, "amount": "200000.00"},
            ],
            user=self.admin,
        )

        buffer, count = generate_trial_balance_pdf(
            org=self.org,
            user=self.admin,
            as_of=date(2026, 10, 10),
        )

        pdf_bytes = buffer.getvalue()
        assert pdf_bytes.startswith(b"%PDF")
        assert len(pdf_bytes) > 500

    def test_row_limit_cap_exceeded(self):
        with patch("payroll.models.PayrollVoucher.objects.filter") as mock_filter:
            mock_filter.return_value.select_related.return_value.count.return_value = 10001
            with pytest.raises(RowLimitExceededError):
                generate_payroll_pdf(org=self.org, user=self.admin)

    def test_multi_tenant_isolation(self):
        org_b, _, tok_b = create_organization("Beta Contractors", "admin@beta.test")
        admin_b, _ = accept_invitation(tok_b, "BetaPass123#", "Admin Beta")

        p_beta = create_project(
            org_b,
            admin_b,
            {"name": "Site Beta", "code": "SB-01", "estimated_budget": Decimal("200000.00")},
        )

        Expense.objects.create(
            organization=org_b,
            project=p_beta,
            category=ExpenseCategory.MATERIAL,
            description="Beta supplies",
            amount=Decimal("9999.00"),
            expense_date=date(2026, 10, 1),
            payment_mode=PaymentMode.CASH,
            status=ExpenseStatus.APPROVED,
            created_by=admin_b,
        )

        # Alpha's expense export must have 0 rows
        buffer, count = generate_expenses_excel(org=self.org, user=self.admin)
        assert count == 0
