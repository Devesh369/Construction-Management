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
from rest_framework import status
from rest_framework.test import APIClient

from accounts.services import accept_invitation, create_organization, create_user_invitation
from core.roles import Role
from core.testing import TenantIsolationTestMixin
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

    def test_uc07_create_project_with_geofence_api(self):
        """UC-07: PM creates project with circular geofence and budget."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tok_pm['access']}")
        data = {
            "name": "Skyline Heights",
            "code": "SKY-001",
            "client_name": "Metro Corp",
            "estimated_budget": "5000000.00",
            "geofence_lat": "19.076000",
            "geofence_lng": "72.877700",
            "geofence_radius_m": 300,
        }
        res = self.client.post("/api/v1/projects", data, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["name"] == "Skyline Heights"
        assert res.data["actual_spend"] == "0.00"
        assert len(res.data["budget_categories"]) == 4

        # Creator PM is auto-added to team roster
        proj_id = res.data["id"]
        assert ProjectMembership.objects.filter(project_id=proj_id, user=self.pm_alpha).exists()

    def test_geofence_validation_requires_both_or_neither(self):
        """Latitude without longitude is rejected."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tok_alpha['access']}")
        res = self.client.post(
            "/api/v1/projects",
            {"name": "Bad Geofence", "code": "BAD-01", "geofence_lat": "19.076000"},
            format="json",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

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
