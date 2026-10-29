"""
API integration tests for Dashboard (Phase P7: Insight).
Tests permissions, status codes, query scoping, and endpoint responses.
"""

from decimal import Decimal

import pytest
from accounts.services import (
    accept_invitation,
    create_organization,
    create_user_invitation,
)
from core.roles import Role
from django.core.cache import cache
from projects.models import ProjectStatus
from projects.services import add_project_member, create_project
from rest_framework import status
from rest_framework.test import APIClient


@pytest.mark.django_db
class TestDashboardAPI:
    def setup_method(self):
        cache.clear()
        self.client = APIClient()

        # Organization Alpha
        self.org, _, self.token = create_organization("Alpha Builders", "admin@alpha.test")
        self.admin, _ = accept_invitation(self.token, "AdminPass123#", "Admin Alpha")

        pm_inv, pm_tok = create_user_invitation(
            self.org, "pm@alpha.test", Role.PROJECT_MANAGER, self.admin
        )
        self.pm, _ = accept_invitation(pm_tok, "PMPass123#", "PM Alpha")

        acc_inv, acc_tok = create_user_invitation(
            self.org, "acc@alpha.test", Role.ACCOUNTANT, self.admin
        )
        self.acc, _ = accept_invitation(acc_tok, "AccPass123#", "Acc Alpha")

        sup_inv, sup_tok = create_user_invitation(
            self.org, "sup@alpha.test", Role.SUPERVISOR, self.admin
        )
        self.sup, _ = accept_invitation(sup_tok, "SupPass123#", "Sup Alpha")

        # Project 1 (assigned to PM)
        self.project1 = create_project(
            self.org,
            self.admin,
            {"name": "Site Alpha", "code": "PRJ-A", "estimated_budget": Decimal("100000.00")},
        )
        self.project1.status = ProjectStatus.ACTIVE
        self.project1.save()
        add_project_member(self.project1, self.pm, site_role="Site PM")

        # Project 2 (not assigned to PM)
        self.project2 = create_project(
            self.org,
            self.admin,
            {"name": "Site Beta", "code": "PRJ-B", "estimated_budget": Decimal("200000.00")},
        )
        self.project2.status = ProjectStatus.ACTIVE
        self.project2.save()

    def test_overview_as_admin(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/v1/dashboard/overview")

        assert response.status_code == status.HTTP_200_OK
        data = response.data
        assert data["active_projects"] == 2
        assert "active_workers" in data
        assert "workers_on_site_today" in data
        assert "month_expenditure" in data
        assert "total_budget" in data
        assert "total_spend" in data
        assert "budget_utilization_percent" in data
        assert "burn_rate_daily" in data
        assert "cash_balance" in data
        assert "bank_balance" in data
        assert "pending_approvals" in data
        assert "spend_by_category" in data
        assert "attendance_trend" in data
        assert "alerts" in data
        assert "projects" in data

    def test_overview_as_accountant(self):
        self.client.force_authenticate(user=self.acc)
        response = self.client.get("/api/v1/dashboard/overview")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["active_projects"] == 2

    def test_overview_as_pm_scoped(self):
        self.client.force_authenticate(user=self.pm)
        response = self.client.get("/api/v1/dashboard/overview")

        assert response.status_code == status.HTTP_200_OK
        # PM is assigned only to Project 1
        assert response.data["active_projects"] == 1
        assert len(response.data["projects"]) == 1
        assert response.data["projects"][0]["id"] == self.project1.id

    def test_overview_unauthenticated_fails(self):
        response = self.client.get("/api/v1/dashboard/overview")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_overview_with_refresh_param(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/v1/dashboard/overview?refresh=true")
        assert response.status_code == status.HTTP_200_OK

    def test_project_detail_as_admin(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f"/api/v1/dashboard/projects/{self.project1.id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.data
        assert data["project_id"] == self.project1.id
        assert data["code"] == "PRJ-A"
        assert data["budget"] == "100000.00"
        assert "spend_by_category" in data
        assert "attendance_trend" in data
        assert "latest_dprs" in data
        assert "pending_items" in data

    def test_project_detail_as_assigned_pm(self):
        self.client.force_authenticate(user=self.pm)
        response = self.client.get(f"/api/v1/dashboard/projects/{self.project1.id}")
        assert response.status_code == status.HTTP_200_OK

    def test_project_detail_as_unassigned_pm_forbidden(self):
        self.client.force_authenticate(user=self.pm)
        response = self.client.get(f"/api/v1/dashboard/projects/{self.project2.id}")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_project_detail_as_supervisor_forbidden(self):
        self.client.force_authenticate(user=self.sup)
        response = self.client.get(f"/api/v1/dashboard/projects/{self.project1.id}")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_project_detail_not_found(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/v1/dashboard/projects/999999")
        assert response.status_code == status.HTTP_404_NOT_FOUND
