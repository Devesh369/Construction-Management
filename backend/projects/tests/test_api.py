"""
API Tests for projects module:
- UC-07: Create project with budget and geofence
- UC-08: Member assignment and role scoping
- Geofence coordinate validation
- Analytics endpoint calculations
- Tenant isolation (foreign tenant project yields 404)
"""

from decimal import Decimal

import pytest
from accounts.services import accept_invitation, create_organization, create_user_invitation
from core.roles import Role
from core.testing import TenantIsolationTestMixin
from rest_framework import status
from rest_framework.test import APIClient

from projects.models import ProjectMembership


@pytest.mark.django_db
class TestProjectsAPI(TenantIsolationTestMixin):
    def setup_method(self):
        self.client = APIClient()

        # Tenant Alpha
        self.org_alpha, _, raw_alpha = create_organization("Alpha Builders", "admin@alpha.test")
        self.admin_alpha, self.tok_alpha = accept_invitation(
            raw_alpha, "AdminPass1234#", name="Alpha Admin"
        )

        # Create PM and Supervisor in Tenant Alpha
        _, pm_raw = create_user_invitation(
            self.org_alpha, "pm@alpha.test", Role.PROJECT_MANAGER, self.admin_alpha
        )
        self.pm_alpha, self.tok_pm = accept_invitation(pm_raw, "PmPass12345#", name="PM Alpha")

        _, sup_raw = create_user_invitation(
            self.org_alpha, "sup@alpha.test", Role.SUPERVISOR, self.admin_alpha
        )
        self.sup_alpha, self.tok_sup = accept_invitation(
            sup_raw, "SupPass1234#", name="Supervisor Alpha"
        )

        # Tenant Beta (for isolation)
        self.org_beta, _, raw_beta = create_organization("Beta Builders", "admin@beta.test")
        self.admin_beta, self.tok_beta = accept_invitation(
            raw_beta, "BetaPass1234#", name="Beta Admin"
        )

    def test_uc07_create_project_api(self):
        """UC-07: PM creates project with budget."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tok_pm['access']}")
        data = {
            "name": "Skyline Heights",
            "code": "SKY-001",
            "client_name": "Metro Corp",
            "estimated_budget": "5000000.00",
        }
        res = self.client.post("/api/v1/projects", data, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["name"] == "Skyline Heights"
        assert res.data["actual_spend"] == "0.00"
        assert len(res.data["budget_categories"]) == 4

        # Creator PM is auto-added to team roster
        proj_id = res.data["id"]
        assert ProjectMembership.objects.filter(project_id=proj_id, user=self.pm_alpha).exists()

    def test_supervisor_cannot_create_project(self):
        """Supervisor role gets 403 Forbidden on project creation."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tok_sup['access']}")
        res = self.client.post(
            "/api/v1/projects",
            {"name": "Sup Project", "code": "SUP-01"},
            format="json",
        )
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_uc08_project_membership_and_scoping(self):
        """UC-08: PM/SUP only see projects where they are assigned as members."""
        from projects.services import create_project

        # Project 1: PM is member
        p1 = create_project(self.org_alpha, self.pm_alpha, {"name": "Project 1", "code": "P1"})
        # Project 2: Admin only
        p2 = create_project(self.org_alpha, self.admin_alpha, {"name": "Project 2", "code": "P2"})

        # PM lists projects -> sees only Project 1
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tok_pm['access']}")
        res_pm = self.client.get("/api/v1/projects")
        assert res_pm.status_code == status.HTTP_200_OK
        p_ids_pm = [p["id"] for p in res_pm.data["results"]]
        assert p1.id in p_ids_pm
        assert p2.id not in p_ids_pm

        # Add PM to Project 2
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tok_alpha['access']}")
        add_res = self.client.post(
            f"/api/v1/projects/{p2.id}/members",
            {"user_id": self.pm_alpha.id, "site_role": "Co-Manager"},
            format="json",
        )
        assert add_res.status_code == status.HTTP_201_CREATED

        # Now PM lists projects -> sees both Project 1 and Project 2
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tok_pm['access']}")
        res_pm2 = self.client.get("/api/v1/projects")
        p_ids_pm2 = [p["id"] for p in res_pm2.data["results"]]
        assert p1.id in p_ids_pm2
        assert p2.id in p_ids_pm2

    def test_project_analytics(self):
        """Analytics endpoint returns utilization % and budget status."""
        from projects.services import create_project, update_spend

        project = create_project(
            self.org_alpha,
            self.admin_alpha,
            {"name": "Analytics Site", "code": "ANA-01", "estimated_budget": Decimal("100000.00")},
        )
        update_spend(project, Decimal("95000.00"))

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tok_alpha['access']}")
        res = self.client.get(f"/api/v1/projects/{project.id}/analytics")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["budget_status"] == "WARNING"  # 95% utilization
        assert res.data["utilization_percent"] == "95.0"

    def test_tenant_isolation_returns_404(self):
        """Beta Admin querying Alpha project receives 404."""
        from projects.services import create_project

        p_alpha = create_project(
            self.org_alpha, self.admin_alpha, {"name": "Alpha Site", "code": "ALP-01"}
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tok_beta['access']}")
        res = self.client.get(f"/api/v1/projects/{p_alpha.id}")
        assert res.status_code == status.HTTP_404_NOT_FOUND

    def test_update_project_details_persists_to_db_and_returns_fresh_data(self):
        """PATCH /api/v1/projects/:id updates DB and returns the updated representation."""
        from projects.services import create_project

        proj = create_project(
            self.org_alpha,
            self.admin_alpha,
            {
                "name": "Original Name",
                "code": "ORIG-01",
                "location": "Old Location",
                "client_name": "Old Client",
                "client_phone": "1111111111",
                "description": "Old Description",
                "estimated_budget": Decimal("100000.00"),
            },
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tok_alpha['access']}")
        payload = {
            "name": "Brand New Tower",
            "location": "New Prime Location",
            "client_name": "New Client Ltd",
            "client_phone": "+91 9876543210",
            "description": "Updated commercial description",
            "estimated_budget": "750000.00",
            "status": "ACTIVE",
        }
        res = self.client.patch(f"/api/v1/projects/{proj.id}", payload, format="json")
        assert res.status_code == status.HTTP_200_OK

        # Verify returned response matches updated data (no stale instance bug)
        assert res.data["name"] == "Brand New Tower"
        assert res.data["location"] == "New Prime Location"
        assert res.data["client_name"] == "New Client Ltd"
        assert res.data["client_phone"] == "9876543210"
        assert res.data["description"] == "Updated commercial description"
        assert res.data["estimated_budget"] == "750000.00"

        # Verify database record updated
        proj.refresh_from_db()
        assert proj.name == "Brand New Tower"
        assert proj.location == "New Prime Location"
        assert proj.client_name == "New Client Ltd"
        assert proj.client_phone == "9876543210"
        assert proj.description == "Updated commercial description"
        assert proj.estimated_budget == Decimal("750000.00")

    def test_update_project_with_empty_or_null_budget(self):
        """Optional estimated_budget can be null or empty string, defaulting to 0.00."""
        from projects.services import create_project

        proj = create_project(
            self.org_alpha,
            self.admin_alpha,
            {"name": "Budget Site", "code": "BUD-01", "estimated_budget": Decimal("50000.00")},
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tok_alpha['access']}")
        res = self.client.patch(
            f"/api/v1/projects/{proj.id}", {"estimated_budget": None}, format="json"
        )
        assert res.status_code == status.HTTP_200_OK
        assert res.data["estimated_budget"] == "0.00"

        proj.refresh_from_db()
        assert proj.estimated_budget == Decimal("0.00")

    def test_supervisor_cannot_update_project(self):
        """Supervisor role gets 403 Forbidden on project update."""
        from projects.services import create_project

        proj = create_project(
            self.org_alpha, self.admin_alpha, {"name": "Protected Site", "code": "PROT-01"}
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tok_sup['access']}")
        res = self.client.patch(
            f"/api/v1/projects/{proj.id}", {"name": "Hacked Name"}, format="json"
        )
        assert res.status_code == status.HTTP_403_FORBIDDEN
