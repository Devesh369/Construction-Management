"""
API integration tests for Payroll module (Phase P6).
Tests advances, runs, vouchers, PDF download, status transitions, and multi-tenancy.
"""

from datetime import date
from decimal import Decimal

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.services import accept_invitation, create_organization, create_user_invitation
from attendance.models import Attendance, AttendanceStatus, ShiftType
from core.roles import Role
from payroll.models import (
    Advance,
    AdvanceStatus,
    PayrollRunStatus,
    VoucherStatus,
)
from projects.services import add_project_member, create_project
from workforce.services import create_employee


@pytest.mark.django_db
class TestPayrollAPI:
    def setup_method(self):
        # 1. Tenant 1: Alpha
        self.org, self.invite, self.token = create_organization(
            "Alpha Builders", "admin@alpha.test"
        )
        self.admin, _ = accept_invitation(self.token, "AdminPass123#", "Admin Alpha")

        acc_inv, acc_tok = create_user_invitation(
            self.org, "acc@alpha.test", Role.ACCOUNTANT, self.admin
        )
        self.acc, _ = accept_invitation(acc_tok, "AccPass123#", "Accountant Alpha")

        pm_inv, pm_tok = create_user_invitation(
            self.org, "pm@alpha.test", Role.PROJECT_MANAGER, self.admin
        )
        self.pm, _ = accept_invitation(pm_tok, "PMPass123#", "PM Alpha")

        sup_inv, sup_tok = create_user_invitation(
            self.org, "sup@alpha.test", Role.SUPERVISOR, self.admin
        )
        self.sup, _ = accept_invitation(sup_tok, "SupPass123#", "Sup Alpha")

        self.project = create_project(
            self.org,
            user=self.admin,
            data={"name": "Alpha Tower", "code": "ALP-P6", "budget": Decimal("20000000.00")},
        )
        add_project_member(self.project, self.pm, site_role="PM")
        add_project_member(self.project, self.acc, site_role="Accountant")
        add_project_member(self.project, self.sup, site_role="Supervisor")

        self.worker = create_employee(
            self.org,
            data={
                "full_name": "Ramesh Kumar",
                "trade": "MASON",
                "employment_type": "DAILY_WAGE",
                "daily_rate": Decimal("850.00"),
                "ot_rate": Decimal("110.00"),
                "upi_id": "ramesh@upi",
                "primary_project": self.project,
            },
            user=self.admin,
        )

        # 2. Tenant 2: Beta (Isolation testing)
        self.beta_org, _, b_tok = create_organization("Beta Construction", "admin@beta.test")
        self.beta_admin, _ = accept_invitation(b_tok, "BetaPass123#", "Admin Beta")
        self.beta_project = create_project(
            self.beta_org,
            user=self.beta_admin,
            data={"name": "Beta Site", "code": "BET-P6", "budget": Decimal("5000000.00")},
        )

        self.client = APIClient()

    def test_record_advance_api(self):
        """Supervisor or PM records a cash advance via API."""
        self.client.force_authenticate(user=self.sup)
        payload = {
            "employee": self.worker.id,
            "project": self.project.id,
            "amount": "1200.00",
            "advance_date": "2026-10-01",
            "payment_mode": "CASH",
            "reason": "Family emergency",
        }
        res = self.client.post("/api/v1/payroll/advances", data=payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["status"] == AdvanceStatus.OPEN
        assert res.data["amount"] == "1200.00"
        assert res.data["remaining_amount"] == "1200.00"

        # List advances
        list_res = self.client.get("/api/v1/payroll/advances")
        assert list_res.status_code == status.HTTP_200_OK
        assert len(list_res.data["results"]) == 1

    def test_payroll_run_lifecycle_api(self):
        """Full payroll run API lifecycle: create -> recalculate -> patch voucher -> approve -> mark-paid."""
        # Setup 4 locked attendance days
        for i in range(1, 5):
            Attendance.objects.create(
                organization=self.org,
                employee=self.worker,
                project=self.project,
                date=date(2026, 10, i),
                shift_type=ShiftType.DAY,
                status=AttendanceStatus.PRESENT,
                is_locked=True,
                marked_by=self.pm,
            )

        # 1. Create DRAFT run (Accountant)
        self.client.force_authenticate(user=self.acc)
        run_payload = {
            "project_id": self.project.id,
            "period_start": "2026-10-01",
            "period_end": "2026-10-05",
        }
        create_res = self.client.post("/api/v1/payroll/runs", data=run_payload, format="json")
        assert create_res.status_code == status.HTTP_201_CREATED
        run_id = create_res.data["id"]
        assert create_res.data["status"] == PayrollRunStatus.DRAFT
        # 4 days * 850 = 3400.00
        assert create_res.data["total_gross"] == "3400.00"
        assert len(create_res.data["vouchers"]) == 1
        voucher_id = create_res.data["vouchers"][0]["id"]

        # 2. Recalculate endpoint
        recalc_res = self.client.post(f"/api/v1/payroll/runs/{run_id}/recalculate")
        assert recalc_res.status_code == status.HTTP_200_OK
        voucher_id = recalc_res.data["vouchers"][0]["id"]

        # 3. Patch voucher (adjust payment mode)
        patch_res = self.client.patch(
            f"/api/v1/payroll/vouchers/{voucher_id}",
            data={"payment_mode": "BANK_TRANSFER"},
            format="json",
        )
        assert patch_res.status_code == status.HTTP_200_OK
        assert patch_res.data["payment_mode"] == "BANK_TRANSFER"

        # 4. Self-approval blocked (acc created the run)
        self_appr = self.client.post(f"/api/v1/payroll/runs/{run_id}/approve")
        assert self_appr.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        # 5. Admin approves run
        self.client.force_authenticate(user=self.admin)
        appr_res = self.client.post(f"/api/v1/payroll/runs/{run_id}/approve")
        assert appr_res.status_code == status.HTTP_200_OK
        assert appr_res.data["status"] == PayrollRunStatus.APPROVED

        # 6. Mark voucher paid
        pay_res = self.client.post(
            f"/api/v1/payroll/vouchers/{voucher_id}/mark-paid",
            data={"payment_reference": "NEFT-77665544"},
            format="json",
        )
        assert pay_res.status_code == status.HTTP_200_OK
        assert pay_res.data["status"] == VoucherStatus.PAID

        # Verify run is now PAID
        run_detail = self.client.get(f"/api/v1/payroll/runs/{run_id}")
        assert run_detail.data["status"] == PayrollRunStatus.PAID

    def test_voucher_pdf_download_endpoint(self):
        """GET /api/v1/payroll/vouchers/{id}/pdf returns application/pdf."""
        Attendance.objects.create(
            organization=self.org,
            employee=self.worker,
            project=self.project,
            date=date(2026, 10, 1),
            shift_type=ShiftType.DAY,
            status=AttendanceStatus.PRESENT,
            is_locked=True,
            marked_by=self.pm,
        )
        self.client.force_authenticate(user=self.acc)
        create_res = self.client.post(
            "/api/v1/payroll/runs",
            data={
                "project_id": self.project.id,
                "period_start": "2026-10-01",
                "period_end": "2026-10-02",
            },
            format="json",
        )
        voucher_id = create_res.data["vouchers"][0]["id"]

        pdf_res = self.client.get(f"/api/v1/payroll/vouchers/{voucher_id}/pdf")
        assert pdf_res.status_code == status.HTTP_200_OK
        assert pdf_res["Content-Type"] == "application/pdf"
        assert pdf_res.content.startswith(b"%PDF")

    def test_cancel_payroll_run_api(self):
        """Cancel payroll run with reason."""
        self.client.force_authenticate(user=self.acc)
        create_res = self.client.post(
            "/api/v1/payroll/runs",
            data={
                "project_id": self.project.id,
                "period_start": "2026-10-01",
                "period_end": "2026-10-02",
            },
            format="json",
        )
        run_id = create_res.data["id"]

        cancel_res = self.client.post(
            f"/api/v1/payroll/runs/{run_id}/cancel",
            data={"reason": "Incorrect date range entered"},
            format="json",
        )
        assert cancel_res.status_code == status.HTTP_200_OK
        assert cancel_res.data["status"] == PayrollRunStatus.CANCELLED

    def test_tenant_isolation(self):
        """Beta user cannot access Alpha's advances, runs, or vouchers."""
        adv = Advance.objects.create(
            organization=self.org,
            employee=self.worker,
            project=self.project,
            amount=Decimal("500.00"),
            advance_date=date(2026, 10, 1),
            given_by=self.pm,
        )

        self.client.force_authenticate(user=self.beta_admin)
        res_adv = self.client.get(f"/api/v1/payroll/advances/{adv.id}")
        assert res_adv.status_code == status.HTTP_404_NOT_FOUND
