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
from rest_framework import status
from rest_framework.test import APIClient

from accounts.services import accept_invitation, create_organization, create_user_invitation
from core.roles import Role
from core.testing import TenantIsolationTestMixin
from projects.services import create_project


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
