"""
API integration tests for Reports exports (Phase P7: Insight).
Tests status codes, Content-Disposition headers, MIME types, role permissions, project scoping, and audit logs.
"""

from datetime import date
from decimal import Decimal
from io import BytesIO
from unittest.mock import patch

import openpyxl
import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.services import (
    accept_invitation,
    create_organization,
    create_user_invitation,
)
from audit.models import AuditLog
from core.exceptions import RowLimitExceededError
from core.roles import Role
from expenses.models import Expense, ExpenseCategory, ExpenseStatus, PaymentMode
from payroll.models import PayrollRun, PayrollRunStatus, PayrollVoucher
from progress.models import DailyProgressReport, DPRStatus
from projects.models import ProjectStatus
from projects.services import add_project_member, create_project
from workforce.services import create_employee


@pytest.mark.django_db
class TestReportsAPI:
    def setup_method(self):
        self.client = APIClient()

        # Organization Alpha
        self.org, _, self.token = create_organization("Zenith Projects", "admin@zenith.test")
        self.admin, _ = accept_invitation(self.token, "AdminPass123#", "Admin Zenith")

        pm_inv, pm_tok = create_user_invitation(
            self.org, "pm@zenith.test", Role.PROJECT_MANAGER, self.admin
        )
        self.pm, _ = accept_invitation(pm_tok, "PMPass123#", "PM Zenith")

        acc_inv, acc_tok = create_user_invitation(
            self.org, "acc@zenith.test", Role.ACCOUNTANT, self.admin
        )
        self.acc, _ = accept_invitation(acc_tok, "AccPass123#", "Acc Zenith")

        sup_inv, sup_tok = create_user_invitation(
            self.org, "sup@zenith.test", Role.SUPERVISOR, self.admin
        )
        self.sup, _ = accept_invitation(sup_tok, "SupPass123#", "Sup Zenith")

        # Project 1 (assigned to PM)
        self.project1 = create_project(
            self.org,
            self.admin,
            {"name": "Highway Overpass", "code": "HW-01", "estimated_budget": Decimal("800000.00")},
        )
        self.project1.status = ProjectStatus.ACTIVE
        self.project1.save()
        add_project_member(self.project1, self.pm, site_role="Site PM")

        # Project 2 (not assigned to PM)
        self.project2 = create_project(
            self.org,
            self.admin,
            {
                "name": "Airport Terminal",
                "code": "AP-02",
                "estimated_budget": Decimal("1500000.00"),
            },
        )
        self.project2.status = ProjectStatus.ACTIVE
        self.project2.save()

        # Worker
        self.worker = create_employee(
            self.org,
            {
                "full_name": "Karan Mehra",
                "employee_code": "EMP-301",
                "daily_rate": Decimal("900.00"),
                "trade": "ELECTRICIAN",
            },
            self.admin,
        )

    def test_payroll_pdf_as_accountant_and_admin(self):
        # Seed an approved payroll run
        run = PayrollRun.objects.create(
            organization=self.org,
            project=self.project1,
            period_start=date(2026, 10, 1),
            period_end=date(2026, 10, 7),
            total_gross=Decimal("5400.00"),
            total_net=Decimal("5400.00"),
            status=PayrollRunStatus.APPROVED,
            created_by=self.admin,
        )
        PayrollVoucher.objects.create(
            organization=self.org,
            run=run,
            employee=self.worker,
            voucher_number="VCH-501",
            days_present=6,
            basic_pay=Decimal("5400.00"),
            gross_pay=Decimal("5400.00"),
            net_pay=Decimal("5400.00"),
        )

        initial_audits = AuditLog.objects.filter(action="REPORT_EXPORTED").count()

        # Call as Accountant via POST
        self.client.force_authenticate(user=self.acc)
        response = self.client.post(
            "/api/v1/reports/payroll/pdf",
            {
                "project_id": self.project1.id,
                "period_start": "2026-10-01",
                "period_end": "2026-10-07",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "application/pdf"
        assert 'attachment; filename="payroll_report.pdf"' in response["Content-Disposition"]
        assert response.content.startswith(b"%PDF")

        # Audit log written
        assert AuditLog.objects.filter(action="REPORT_EXPORTED").count() == initial_audits + 1

    def test_payroll_pdf_forbidden_for_pm(self):
        self.client.force_authenticate(user=self.pm)
        response = self.client.post("/api/v1/reports/payroll/pdf", {})
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_dpr_excel_as_pm(self):
        DailyProgressReport.objects.create(
            organization=self.org,
            project=self.project1,
            report_date=date(2026, 10, 5),
            summary="Deck slab reinforcement complete",
            status=DPRStatus.VERIFIED,
            submitted_by=self.admin,
            verified_by=self.admin,
        )

        self.client.force_authenticate(user=self.pm)
        response = self.client.get(
            f"/api/v1/reports/dpr/excel?project_id={self.project1.id}&date_from=2026-10-01&date_to=2026-10-10"
        )

        assert response.status_code == status.HTTP_200_OK
        assert (
            response["Content-Type"]
            == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        assert 'attachment; filename="dpr_report.xlsx"' in response["Content-Disposition"]

        wb = openpyxl.load_workbook(BytesIO(response.content))
        assert "DPR Summary Log" in wb.sheetnames

    def test_dpr_excel_forbidden_for_accountant(self):
        self.client.force_authenticate(user=self.acc)
        response = self.client.get("/api/v1/reports/dpr/excel")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_expenses_excel_as_pm_and_accountant(self):
        Expense.objects.create(
            organization=self.org,
            project=self.project1,
            category=ExpenseCategory.MATERIAL,
            description="Bitumen drum",
            amount=Decimal("18000.00"),
            expense_date=date(2026, 10, 4),
            payment_mode=PaymentMode.CASH,
            status=ExpenseStatus.APPROVED,
            created_by=self.admin,
        )

        # PM can export expenses for assigned project
        self.client.force_authenticate(user=self.pm)
        res_pm = self.client.post(
            "/api/v1/reports/expenses/excel",
            {"project_id": self.project1.id},
            format="json",
        )
        assert res_pm.status_code == status.HTTP_200_OK
        assert (
            res_pm["Content-Type"]
            == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

        # ACC can export
        self.client.force_authenticate(user=self.acc)
        res_acc = self.client.get("/api/v1/reports/expenses/excel")
        assert res_acc.status_code == status.HTTP_200_OK

        # SUP cannot export
        self.client.force_authenticate(user=self.sup)
        res_sup = self.client.get("/api/v1/reports/expenses/excel")
        assert res_sup.status_code == status.HTTP_403_FORBIDDEN

    def test_profit_loss_pdf_as_accountant(self):
        self.client.force_authenticate(user=self.acc)
        response = self.client.post(
            "/api/v1/reports/profit-loss/pdf",
            {"date_from": "2026-10-01", "date_to": "2026-10-10"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "application/pdf"
        assert response.content.startswith(b"%PDF")

        # PM is forbidden
        self.client.force_authenticate(user=self.pm)
        res_pm = self.client.post("/api/v1/reports/profit-loss/pdf", {})
        assert res_pm.status_code == status.HTTP_403_FORBIDDEN

    def test_attendance_excel_as_pm(self):
        self.client.force_authenticate(user=self.pm)
        response = self.client.get(
            f"/api/v1/reports/attendance/excel?project_id={self.project1.id}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert (
            response["Content-Type"]
            == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

        wb = openpyxl.load_workbook(BytesIO(response.content))
        assert "Muster Roll Summary" in wb.sheetnames

    def test_trial_balance_pdf_as_accountant(self):
        self.client.force_authenticate(user=self.acc)
        response = self.client.get("/api/v1/reports/trial-balance/pdf?as_of=2026-10-10")
        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "application/pdf"
        assert response.content.startswith(b"%PDF")

        # PM is forbidden
        self.client.force_authenticate(user=self.pm)
        res_pm = self.client.get("/api/v1/reports/trial-balance/pdf")
        assert res_pm.status_code == status.HTTP_403_FORBIDDEN

    def test_pm_unassigned_project_forbidden(self):
        self.client.force_authenticate(user=self.pm)
        # PM is not assigned to Project 2
        response = self.client.post(
            "/api/v1/reports/dpr/excel",
            {"project_id": self.project2.id},
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_requests_fail(self):
        res1 = self.client.get("/api/v1/reports/payroll/pdf")
        assert res1.status_code == status.HTTP_401_UNAUTHORIZED

        res2 = self.client.get("/api/v1/reports/dpr/excel")
        assert res2.status_code == status.HTTP_401_UNAUTHORIZED

    def test_row_limit_cap_413_response(self):
        self.client.force_authenticate(user=self.acc)
        with patch("reports.views.generate_payroll_pdf") as mock_gen:
            mock_gen.side_effect = RowLimitExceededError()
            response = self.client.post("/api/v1/reports/payroll/pdf", {})
            assert response.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
            assert response.data["error"]["code"] == "row_limit_exceeded"
