"""
API Tests for workforce module:
- UC-09: Employee registration
- Sensitive banking and identity field masking for SUP and ENG
- Pay-rate permissions (Supervisor cannot modify wage rates)
- UC-10: Labor gang creation, member addition, and deletion rules
- Tenant isolation (foreign tenant worker yields 404)
"""

from decimal import Decimal

import pytest
from accounts.services import accept_invitation, create_organization, create_user_invitation
from core.roles import Role
from core.testing import TenantIsolationTestMixin
from projects.services import create_project
from rest_framework import status
from rest_framework.test import APIClient


@pytest.mark.django_db
class TestWorkforceAPI(TenantIsolationTestMixin):
    def setup_method(self):
        self.client = APIClient()

        # Tenant Alpha
        self.org_alpha, _, raw_alpha = create_organization(
            "Alpha Workforce Org", "admin@alpha.test"
        )
        self.admin_alpha, self.tok_alpha = accept_invitation(
            raw_alpha, "AdminPass1234#", name="Alpha Admin"
        )

        # Project Lead PM
        _, pm_raw = create_user_invitation(
            self.org_alpha, "pm@alpha.test", Role.PROJECT_MANAGER, self.admin_alpha
        )
        self.pm_alpha, self.tok_pm = accept_invitation(pm_raw, "PmPass12345#", name="PM Alpha")

        # Supervisor
        _, sup_raw = create_user_invitation(
            self.org_alpha, "sup@alpha.test", Role.SUPERVISOR, self.admin_alpha
        )
        self.sup_alpha, self.tok_sup = accept_invitation(
            sup_raw, "SupPass1234#", name="Supervisor Alpha"
        )

        # Project
        self.project_alpha = create_project(
            self.org_alpha, self.admin_alpha, {"name": "Alpha Tower", "code": "AT-01"}
        )

        # Tenant Beta (for isolation)
        self.org_beta, _, raw_beta = create_organization("Beta Workforce Org", "admin@beta.test")
        self.admin_beta, self.tok_beta = accept_invitation(
            raw_beta, "BetaPass1234#", name="Beta Admin"
        )

    def test_uc09_register_worker_api(self):
        """UC-09: PM registers worker with bank details and daily wage."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tok_pm['access']}")
        data = {
            "full_name": "Deepak Sharma",
            "trade": "MASON",
            "employment_type": "DAILY_WAGE",
            "daily_rate": "800.00",
            "bank_account_number": "1234567890",
            "bank_ifsc": "SBIN0001234",
            "upi_id": "deepak@upi",
            "primary_project": self.project_alpha.id,
        }
        res = self.client.post("/api/v1/employees", data, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["employee_code"].startswith("EMP-")
        assert res.data["effective_daily_rate"] == "800.00"

    def test_sensitive_fields_hidden_from_supervisor(self):
        """Sensitive bank and identity proof fields are omitted in response for Supervisor."""
        # Create worker with bank details as PM
        from workforce.services import create_employee

        worker = create_employee(
            self.org_alpha,
            {
                "full_name": "Mahesh Giri",
                "trade": "CARPENTER",
                "daily_rate": Decimal("900.00"),
                "bank_account_name": "Mahesh Giri",
                "bank_account_number": "987654321012",
                "bank_ifsc": "HDFC0001234",
                "upi_id": "mahesh@okhdfcbank",
                "id_proof_number": "444455556666",
            },
            self.pm_alpha,
        )

        # 1. PM queries worker -> sees all sensitive fields
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tok_pm['access']}")
        res_pm = self.client.get(f"/api/v1/employees/{worker.id}")
        assert res_pm.status_code == status.HTTP_200_OK
        assert "bank_account_number" in res_pm.data
        assert res_pm.data["bank_account_number"] == "987654321012"

        # 2. Supervisor queries worker -> sensitive fields are omitted
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tok_sup['access']}")
        res_sup = self.client.get(f"/api/v1/employees/{worker.id}")
        assert res_sup.status_code == status.HTTP_200_OK
        assert "bank_account_number" not in res_sup.data
        assert "bank_ifsc" not in res_sup.data
        assert "upi_id" not in res_sup.data
        assert "id_proof_number" not in res_sup.data

    def test_supervisor_cannot_modify_pay_rates(self):
        """Supervisor attempting to change pay rates gets 422 BusinessRuleError."""
        from workforce.services import create_employee

        worker = create_employee(
            self.org_alpha,
            {"full_name": "Karan Singh", "daily_rate": Decimal("700.00")},
            self.admin_alpha,
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tok_sup['access']}")
        res = self.client.patch(
            f"/api/v1/employees/{worker.id}",
            {"daily_rate": "950.00"},
            format="json",
        )
        assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_uc10_labor_group_management_api(self):
        """UC-10: Create gang, add members, remove member."""
        from workforce.services import create_employee

        w1 = create_employee(
            self.org_alpha,
            {"full_name": "Worker 1", "daily_rate": Decimal("600.00")},
            self.admin_alpha,
        )
        w2 = create_employee(
            self.org_alpha,
            {"full_name": "Worker 2", "daily_rate": Decimal("600.00")},
            self.admin_alpha,
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tok_pm['access']}")

        # Create gang
        res_gang = self.client.post(
            "/api/v1/labor-groups",
            {"name": "Carpentry Gang 1", "project": self.project_alpha.id},
            format="json",
        )
        assert res_gang.status_code == status.HTTP_201_CREATED
        gang_id = res_gang.data["id"]

        # Add workers to gang
        add_res = self.client.post(
            f"/api/v1/labor-groups/{gang_id}/members",
            {"employee_ids": [w1.id, w2.id]},
            format="json",
        )
        assert add_res.status_code == status.HTTP_200_OK
        assert add_res.data["count"] == 2

        # Remove worker 1
        del_res = self.client.delete(f"/api/v1/labor-groups/{gang_id}/members/{w1.id}")
        assert del_res.status_code == status.HTTP_204_NO_CONTENT
        w1.refresh_from_db()
        assert w1.group is None

    def test_tenant_isolation_returns_404(self):
        """Beta Admin querying Alpha Employee receives 404."""
        from workforce.services import create_employee

        worker_alpha = create_employee(
            self.org_alpha,
            {"full_name": "Alpha Worker", "daily_rate": Decimal("600.00")},
            self.admin_alpha,
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tok_beta['access']}")
        res = self.client.get(f"/api/v1/employees/{worker_alpha.id}")
        assert res.status_code == status.HTTP_404_NOT_FOUND

    def test_register_employee_with_custom_role_contact_and_bank_details(self):
        """Register worker with Full Name, Phone, Email, Role, Address, Emergency Contact, Bank Details."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tok_alpha['access']}")
        data = {
            "full_name": "Prakash Patel",
            "phone": "+91 9898082719",
            "email": "prakash@example.com",
            "role": "Karigar",
            "daily_rate": "1000.00",
            "address": "Atladra Main Road, Vadodara",
            "emergency_contact": "+91 9898000000",
            "joining_date": "2026-06-29",
            "bank_account_number": "123456789012",
            "bank_ifsc": "SBIN0001234",
            "bank_name": "State Bank of India",
        }
        res = self.client.post("/api/v1/employees", data, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["full_name"] == "Prakash Patel"
        assert res.data["phone"] == "9898082719"
        assert res.data["role"] == "Karigar"
        assert res.data["email"] == "prakash@example.com"
        assert res.data["address"] == "Atladra Main Road, Vadodara"
        assert res.data["bank_name"] == "State Bank of India"
        assert "financials" in res.data
        assert res.data["financials"]["balance"] == "0.00"

    def test_assign_and_unassign_projects_to_employee(self):
        """Assign project to employee and unassign project."""
        from workforce.services import create_employee

        worker = create_employee(
            self.org_alpha,
            {"full_name": "Ramesh Kumar", "daily_rate": Decimal("800.00")},
            self.admin_alpha,
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tok_alpha['access']}")
        # Assign project
        res_assign = self.client.post(
            f"/api/v1/employees/{worker.id}/assign-project",
            {"project_id": self.project_alpha.id},
            format="json",
        )
        assert res_assign.status_code == status.HTTP_200_OK
        assert len(res_assign.data["assigned_projects_details"]) == 1
        assert res_assign.data["assigned_projects_details"][0]["id"] == self.project_alpha.id

        # Unassign project
        res_unassign = self.client.post(
            f"/api/v1/employees/{worker.id}/unassign-project",
            {"project_id": self.project_alpha.id},
            format="json",
        )
        assert res_unassign.status_code == status.HTTP_200_OK
        assert len(res_unassign.data["assigned_projects_details"]) == 0

    def test_employee_pay_and_upad_actions(self):
        """Record advance (upad) and payment (pay) for employee and verify ledger history."""
        from workforce.services import create_employee

        worker = create_employee(
            self.org_alpha,
            {"full_name": "Suresh Bhai", "daily_rate": Decimal("1000.00")},
            self.admin_alpha,
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tok_alpha['access']}")
        # 1. Record Upad
        upad_res = self.client.post(
            f"/api/v1/employees/{worker.id}/upad",
            {"amount": "2000.00", "reason": "Diwali Advance", "payment_mode": "CASH"},
            format="json",
        )
        assert upad_res.status_code == status.HTTP_201_CREATED
        assert upad_res.data["financials"]["total_upad"] == "2000.00"

        # 2. Attempt Pay without attendance -> HTTP 400 Bad Request
        pay_reject = self.client.post(
            f"/api/v1/employees/{worker.id}/pay",
            {"amount": "3000.00", "payment_mode": "BANK_TRANSFER", "notes": "Weekly Wage"},
            format="json",
        )
        assert pay_reject.status_code == status.HTTP_400_BAD_REQUEST
        assert "attendance" in pay_reject.data["error"].lower()

        # Mark attendance for worker
        from attendance.models import Attendance, AttendanceStatus
        from django.utils import timezone

        Attendance.objects.create(
            organization=self.org_alpha,
            employee=worker,
            project=self.project_alpha,
            date=timezone.localdate(),
            status=AttendanceStatus.PRESENT,
            marked_by=self.admin_alpha,
        )

        # 3. Record Pay after attendance is marked -> HTTP 201 Created
        pay_res = self.client.post(
            f"/api/v1/employees/{worker.id}/pay",
            {"amount": "3000.00", "payment_mode": "BANK_TRANSFER", "notes": "Weekly Wage"},
            format="json",
        )
        assert pay_res.status_code == status.HTTP_201_CREATED
        assert pay_res.data["financials"]["total_paid"] == "3000.00"

        # 4. Check Payment History
        hist_res = self.client.get(f"/api/v1/employees/{worker.id}/payment-history")
        assert hist_res.status_code == status.HTTP_200_OK
        assert len(hist_res.data) == 2
        types = [item["type"] for item in hist_res.data]
        assert "UPAD" in types
        assert "PAYMENT" in types

    def test_upad_800_salary_with_500_advance_leaves_300_remaining(self):
        """
        Verify Requirement 4:
        When someone's salary is 800/day and takes 500 advance, remaining salary is 300.
        Reflected across Workforce, Upad payments, and Attendance settlement.
        """
        from attendance.models import Attendance, AttendanceStatus
        from attendance.services_settlement import AttendanceSettlementService
        from django.utils import timezone

        from workforce.services import create_employee

        worker = create_employee(
            self.org_alpha,
            {"full_name": "Ramesh Kumar", "daily_rate": Decimal("800.00")},
            self.admin_alpha,
        )

        # 1 day attendance present
        today = timezone.localdate()
        att = Attendance.objects.create(
            organization=self.org_alpha,
            employee=worker,
            project=self.project_alpha,
            date=today,
            status=AttendanceStatus.PRESENT,
            marked_by=self.admin_alpha,
        )

        # Initially, balance is 800.00
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tok_alpha['access']}")
        res_emp = self.client.get(f"/api/v1/employees/{worker.id}")
        assert res_emp.status_code == status.HTTP_200_OK
        assert res_emp.data["financials"]["total_pagar"] == "800.00"
        assert res_emp.data["financials"]["balance"] == "800.00"

        # Record Upad advance of 500 via UPAD Payment module
        pay_res = self.client.post(
            "/api/v1/payments",
            {
                "employee": worker.id,
                "project": self.project_alpha.id,
                "type": "advance",
                "amount": "500.00",
                "method": "cash",
                "status": "paid",
                "description": "Upad advance against daily wage",
            },
            format="json",
        )
        assert pay_res.status_code == status.HTTP_201_CREATED

        # Verify employee balance reflects remaining salary is 300
        res_after = self.client.get(f"/api/v1/employees/{worker.id}")
        assert res_after.data["financials"]["total_pagar"] == "800.00"
        assert res_after.data["financials"]["total_upad"] == "500.00"
        assert res_after.data["financials"]["balance"] == "300.00"

        # Verify Attendance Settlement Service computes remaining salary as 300
        rem = AttendanceSettlementService.get_remaining_salary(worker)
        assert rem["total_earned"] == 800.0
        assert rem["total_paid"] == 500.0
        assert rem["remaining_salary"] == 300.0

        # Verify attendance settlement has 500 settled and 300 unsettled
        att.refresh_from_db()
        assert att.settled_amount == Decimal("500.00")
        assert att.is_settled is False
