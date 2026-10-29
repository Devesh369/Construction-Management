"""
End-to-End Acceptance Test for Workflow 3: Weekly Payroll & Ledger Settlement (Phase P8).
Covers:
1. Mid-week worker advances recorded (POST /api/v1/payroll/advances): DR 1100 Advances / CR 1001 Cash.
2. End of week: locked attendance records processed by ACC (POST /api/v1/payroll/runs) -> DRAFT run with vouchers.
3. ADM approves (POST /api/v1/payroll/runs/{id}/approve):
   Balanced double-entry journal posted (DR Wages / CR Advances + CR Bank), advances adjusted, project spend rises.
4. ACC marks vouchers paid (POST /api/v1/payroll/vouchers/{id}/mark-paid); exports PDF (POST /api/v1/reports/payroll/pdf); run turns PAID.
5. Trial balance (GET /api/v1/ledger/trial-balance) and Dashboard (GET /api/v1/dashboard/overview) verified balanced.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from accounts.services import (
    accept_invitation,
    create_organization,
    create_user_invitation,
)
from attendance.models import Attendance, AttendanceStatus
from core.roles import Role
from ledger.models import Side
from ledger.services import post_journal_entry, trial_balance
from payroll.models import (
    Advance,
    AdvanceStatus,
    PayrollRun,
    PayrollRunStatus,
    VoucherStatus,
)
from projects.models import ProjectStatus
from projects.services import add_project_member, create_project
from rest_framework import status
from rest_framework.test import APIClient
from workforce.services import create_employee


@pytest.mark.django_db
class TestWorkflow3WeeklyPayrollAndLedger:
    def setup_method(self):
        self.org, _, self.tok = create_organization(
            name="Apex Horizon Builders",
            admin_email="admin@apexhorizon.test",
        )
        self.admin, _ = accept_invitation(self.tok, "AdminPass123#", "Admin Horizon")

        # Create PM and ACC
        _, pm_tok = create_user_invitation(
            self.org, "pm@apexhorizon.test", Role.PROJECT_MANAGER, self.admin
        )
        self.pm, _ = accept_invitation(pm_tok, "PMPass123#", "Site PM")

        _, acc_tok = create_user_invitation(
            self.org, "acc@apexhorizon.test", Role.ACCOUNTANT, self.admin
        )
        self.acc, _ = accept_invitation(acc_tok, "AccPass123#", "Head Accountant")

        # Project
        self.project = create_project(
            self.org,
            self.admin,
            {
                "name": "Horizon Center",
                "code": "PRJ-HC",
                "estimated_budget": Decimal("10000000.00"),
                "status": ProjectStatus.ACTIVE,
            },
        )
        add_project_member(self.project, self.pm, site_role="Site PM")

        # Capital injection to provide bank balance
        today = date(2026, 10, 1)
        post_journal_entry(
            org=self.org,
            date=today,
            description="Capital injection",
            lines=[
                {"account_code": "1002", "side": Side.DR, "amount": "1000000.00"},
                {"account_code": "3001", "side": Side.CR, "amount": "1000000.00"},
                {"account_code": "1001", "side": Side.DR, "amount": "50000.00"},
                {"account_code": "1002", "side": Side.CR, "amount": "50000.00"},
            ],
            user=self.admin,
        )

        # Workers
        self.w1 = create_employee(
            self.org,
            {
                "full_name": "Raju Gaikwad",
                "employee_code": "W-101",
                "daily_rate": Decimal("800.00"),
                "trade": "MASON",
            },
            self.admin,
        )
        self.w2 = create_employee(
            self.org,
            {
                "full_name": "Manoj Solanki",
                "employee_code": "W-102",
                "daily_rate": Decimal("900.00"),
                "trade": "ELECTRICIAN",
            },
            self.admin,
        )

        self.pm_client = APIClient()
        self.pm_client.force_authenticate(user=self.pm)

        self.acc_client = APIClient()
        self.acc_client.force_authenticate(user=self.acc)

        self.admin_client = APIClient()
        self.admin_client.force_authenticate(user=self.admin)

    def test_workflow_3_payroll_and_ledger(self):
        week_start = date(2026, 9, 21)
        week_end = date(2026, 9, 27)

        # ----------------------------------------------------------------------
        # Step 1: During the Week - Record Worker Advance
        # ----------------------------------------------------------------------
        adv_res = self.pm_client.post(
            "/api/v1/payroll/advances",
            {
                "employee": self.w1.id,
                "project": self.project.id,
                "amount": "1500.00",
                "advance_date": str(week_start + timedelta(days=2)),
                "reason": "Mid-week medical emergency",
                "payment_mode": "CASH",
            },
            format="json",
        )
        assert adv_res.status_code == status.HTTP_201_CREATED
        adv_id = adv_res.data["id"]

        adv_obj = Advance.objects.get(id=adv_id)
        assert adv_obj.status == AdvanceStatus.OPEN
        assert adv_obj.journal_entry is not None  # DR 1100 / CR 1001

        # ----------------------------------------------------------------------
        # Step 2: Seed 6 Days of Locked Attendance for Workers
        # ----------------------------------------------------------------------
        for day_idx in range(6):
            cur_date = week_start + timedelta(days=day_idx)
            Attendance.objects.create(
                organization=self.org,
                project=self.project,
                employee=self.w1,
                date=cur_date,
                status=AttendanceStatus.PRESENT,
                ot_hours=Decimal("2.00") if day_idx == 0 else Decimal("0.00"),
                is_locked=True,
                marked_by=self.pm,
            )
            Attendance.objects.create(
                organization=self.org,
                project=self.project,
                employee=self.w2,
                date=cur_date,
                status=AttendanceStatus.PRESENT,
                ot_hours=Decimal("0.00"),
                is_locked=True,
                marked_by=self.pm,
            )

        # ----------------------------------------------------------------------
        # Step 3: End of Week - ACC Calculates Payroll Run (Creates DRAFT Vouchers)
        # ----------------------------------------------------------------------
        run_res = self.acc_client.post(
            "/api/v1/payroll/runs",
            {
                "project_id": self.project.id,
                "period_start": str(week_start),
                "period_end": str(week_end),
            },
            format="json",
        )
        assert run_res.status_code == status.HTTP_201_CREATED
        run_id = run_res.data["id"]

        run_obj = PayrollRun.objects.get(id=run_id)
        assert run_obj.status == PayrollRunStatus.DRAFT
        assert run_obj.vouchers.count() == 2

        # Verify advance was applied as deduction to Worker 1
        v1 = run_obj.vouchers.get(employee=self.w1)
        assert v1.advances_deducted == Decimal("1500.00")
        assert v1.gross_pay > v1.net_pay

        # ----------------------------------------------------------------------
        # Step 4: ADM Approves Payroll Run
        # ----------------------------------------------------------------------
        initial_spend = self.project.actual_spend
        appr_res = self.admin_client.post(
            f"/api/v1/payroll/runs/{run_id}/approve",
            {},
            format="json",
        )
        assert appr_res.status_code == status.HTTP_200_OK

        run_obj.refresh_from_db()
        assert run_obj.status == PayrollRunStatus.APPROVED
        assert run_obj.journal_entry is not None

        # Verify advance marked ADJUSTED
        adv_obj.refresh_from_db()
        assert adv_obj.status == AdvanceStatus.ADJUSTED

        # Verify project actual spend increased by total gross
        self.project.refresh_from_db()
        assert self.project.actual_spend == initial_spend + run_obj.total_gross

        # ----------------------------------------------------------------------
        # Step 5: ACC Marks Vouchers Paid & Exports Wage Register PDF
        # ----------------------------------------------------------------------
        for v in run_obj.vouchers.all():
            paid_res = self.acc_client.post(
                f"/api/v1/payroll/vouchers/{v.id}/mark-paid",
                {"payment_reference": f"UPI-TXN-{v.id}"},
                format="json",
            )
            assert paid_res.status_code == status.HTTP_200_OK
            v.refresh_from_db()
            assert v.status == VoucherStatus.PAID

        # Once all vouchers are paid, run status turns PAID
        run_obj.refresh_from_db()
        assert run_obj.status == PayrollRunStatus.PAID

        # Export Wage Register PDF
        pdf_res = self.acc_client.post(
            "/api/v1/reports/payroll/pdf",
            {
                "project_id": self.project.id,
                "period_start": str(week_start),
                "period_end": str(week_end),
            },
            format="json",
        )
        assert pdf_res.status_code == status.HTTP_200_OK
        assert pdf_res["Content-Type"] == "application/pdf"
        assert pdf_res.content.startswith(b"%PDF")

        # ----------------------------------------------------------------------
        # Step 6: Trial Balance & Dashboard Overview Consistency Check
        # ----------------------------------------------------------------------
        # A) Trial Balance debits equal credits
        tb_data = trial_balance(self.org)
        assert tb_data["is_balanced"] is True
        assert tb_data["total_debit"] == tb_data["total_credit"]

        # B) Dashboard overview reflects payroll and project spend
        dash_res = self.admin_client.get("/api/v1/dashboard/overview?refresh=true")
        assert dash_res.status_code == status.HTTP_200_OK
        assert Decimal(dash_res.data["total_spend"]) == self.project.actual_spend
