"""
Comprehensive language-level Role-Based Access Control (RBAC) tests.
Verifies that security checks are strictly enforced in Python/DRF permission classes
and viewsets (returning HTTP 403 Forbidden), rather than only relying on client-side HTML/React.
"""

from decimal import Decimal

import pytest
from accounts.services import accept_invitation, create_organization, create_user_invitation
from core.roles import Role
from projects.models import ProjectStatus
from projects.services import add_project_member, create_project
from rest_framework import status
from rest_framework.test import APIClient


@pytest.mark.django_db
class TestLanguageLevelRoleSecurity:
    def setup_method(self):
        self.client = APIClient()

        # Organization
        self.org, _, tok_admin = create_organization("Apex Infra", "admin@apexinfra.test")
        self.admin, _ = accept_invitation(tok_admin, "AdminPass123#", "Admin Apex")

        # Project Manager
        _, tok_pm = create_user_invitation(
            self.org, "pm@apex.test", Role.PROJECT_MANAGER, self.admin
        )
        self.pm, _ = accept_invitation(tok_pm, "PmPass123#", "PM Apex")

        # Site Engineer
        _, tok_eng = create_user_invitation(
            self.org, "eng@apex.test", Role.SITE_ENGINEER, self.admin
        )
        self.eng, _ = accept_invitation(tok_eng, "EngPass123#", "Eng Apex")

        # Supervisor
        _, tok_sup = create_user_invitation(self.org, "sup@apex.test", Role.SUPERVISOR, self.admin)
        self.sup, _ = accept_invitation(tok_sup, "SupPass123#", "Sup Apex")

        # Accountant
        _, tok_acc = create_user_invitation(self.org, "acc@apex.test", Role.ACCOUNTANT, self.admin)
        self.acc, _ = accept_invitation(tok_acc, "AccPass123#", "Acc Apex")

        # Project
        self.project = create_project(
            self.org,
            self.admin,
            {"name": "Site Alpha", "code": "ALP-01", "estimated_budget": Decimal("500000.00")},
        )
        self.project.status = ProjectStatus.ACTIVE
        self.project.save()

        add_project_member(self.project, self.pm, site_role="Project Manager")
        add_project_member(self.project, self.eng, site_role="Site Engineer")
        add_project_member(self.project, self.sup, site_role="Supervisor")

    # ---------------------------------------------------------
    # 1. SUPERVISOR Permissions & Restrictions
    # ---------------------------------------------------------
    def test_supervisor_forbidden_from_dashboard(self):
        self.client.force_authenticate(user=self.sup)
        res = self.client.get("/api/v1/dashboard/overview")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_supervisor_forbidden_from_ledger_accounts(self):
        self.client.force_authenticate(user=self.sup)
        res = self.client.get("/api/v1/ledger/accounts")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_supervisor_forbidden_from_payment_central(self):
        self.client.force_authenticate(user=self.sup)
        res = self.client.get("/api/v1/ledger/transactions")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_supervisor_forbidden_from_upad_payments(self):
        self.client.force_authenticate(user=self.sup)
        res = self.client.get("/api/v1/payroll/payments")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_supervisor_forbidden_from_payroll_runs(self):
        self.client.force_authenticate(user=self.sup)
        res = self.client.get("/api/v1/payroll/runs")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_supervisor_forbidden_from_user_management(self):
        self.client.force_authenticate(user=self.sup)
        res = self.client.get("/api/v1/users")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_supervisor_can_access_workforce_and_attendance(self):
        self.client.force_authenticate(user=self.sup)
        res_emp = self.client.get("/api/v1/employees")
        assert res_emp.status_code == status.HTTP_200_OK

        res_att = self.client.get("/api/v1/attendance")
        assert res_att.status_code == status.HTTP_200_OK

    # ---------------------------------------------------------
    # 2. SITE ENGINEER Permissions & Restrictions
    # ---------------------------------------------------------
    def test_site_engineer_forbidden_from_dashboard(self):
        self.client.force_authenticate(user=self.eng)
        res = self.client.get("/api/v1/dashboard/overview")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_site_engineer_forbidden_from_workforce(self):
        self.client.force_authenticate(user=self.eng)
        res = self.client.get("/api/v1/employees")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_site_engineer_forbidden_from_attendance(self):
        self.client.force_authenticate(user=self.eng)
        res = self.client.get("/api/v1/attendance")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_site_engineer_forbidden_from_upad_payments(self):
        self.client.force_authenticate(user=self.eng)
        res = self.client.get("/api/v1/payroll/payments")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_site_engineer_forbidden_from_payroll_runs(self):
        self.client.force_authenticate(user=self.eng)
        res = self.client.get("/api/v1/payroll/runs")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_site_engineer_forbidden_from_ledger(self):
        self.client.force_authenticate(user=self.eng)
        res = self.client.get("/api/v1/ledger/accounts")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_site_engineer_can_access_progress_and_projects(self):
        self.client.force_authenticate(user=self.eng)
        res_dpr = self.client.get("/api/v1/dpr")
        assert res_dpr.status_code == status.HTTP_200_OK

        res_work = self.client.get("/api/v1/work-entries")
        assert res_work.status_code == status.HTTP_200_OK

        res_proj = self.client.get("/api/v1/projects")
        assert res_proj.status_code == status.HTTP_200_OK

    # ---------------------------------------------------------
    # 3. ACCOUNTANT Permissions & Restrictions
    # ---------------------------------------------------------
    def test_accountant_forbidden_from_progress(self):
        self.client.force_authenticate(user=self.acc)
        res_dpr = self.client.get("/api/v1/dpr")
        assert res_dpr.status_code == status.HTTP_403_FORBIDDEN

        res_work = self.client.get("/api/v1/work-entries")
        assert res_work.status_code == status.HTTP_403_FORBIDDEN

    def test_accountant_forbidden_from_labor_groups(self):
        self.client.force_authenticate(user=self.acc)
        res = self.client.get("/api/v1/labor-groups")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_accountant_forbidden_from_marking_attendance(self):
        self.client.force_authenticate(user=self.acc)
        payload = {
            "employee_id": 1,
            "project_id": self.project.id,
        }
        res = self.client.post("/api/v1/attendance/check-in", payload, format="json")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_accountant_forbidden_from_user_management(self):
        self.client.force_authenticate(user=self.acc)
        res = self.client.get("/api/v1/users")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_accountant_can_access_financials_and_ledger(self):
        self.client.force_authenticate(user=self.acc)
        res_exp = self.client.get("/api/v1/expenses")
        assert res_exp.status_code == status.HTTP_200_OK

        res_upad = self.client.get("/api/v1/payroll/payments")
        assert res_upad.status_code == status.HTTP_200_OK

        res_txns = self.client.get("/api/v1/ledger/transactions")
        assert res_txns.status_code == status.HTTP_200_OK

        res_ledger = self.client.get("/api/v1/ledger/accounts")
        assert res_ledger.status_code == status.HTTP_200_OK

        res_runs = self.client.get("/api/v1/payroll/runs")
        assert res_runs.status_code == status.HTTP_200_OK

    # ---------------------------------------------------------
    # 4. PROJECT MANAGER Permissions & Restrictions
    # ---------------------------------------------------------
    def test_project_manager_forbidden_from_payroll_runs(self):
        self.client.force_authenticate(user=self.pm)
        res = self.client.get("/api/v1/payroll/runs")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_project_manager_forbidden_from_user_management(self):
        self.client.force_authenticate(user=self.pm)
        res = self.client.get("/api/v1/users")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_project_manager_forbidden_from_deleting_project(self):
        self.client.force_authenticate(user=self.pm)
        res = self.client.delete(f"/api/v1/projects/{self.project.id}")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_project_manager_forbidden_from_unlocking_attendance(self):
        self.client.force_authenticate(user=self.pm)
        payload = {
            "project_id": self.project.id,
            "date": "2026-10-01",
            "reason": "Test unlock reason",
        }
        res = self.client.post("/api/v1/attendance/unlock", payload, format="json")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_project_manager_can_access_dashboard_and_projects(self):
        self.client.force_authenticate(user=self.pm)
        res_dash = self.client.get("/api/v1/dashboard/overview")
        assert res_dash.status_code == status.HTTP_200_OK

        res_proj = self.client.get("/api/v1/projects")
        assert res_proj.status_code == status.HTTP_200_OK

        res_exp = self.client.get("/api/v1/expenses")
        assert res_exp.status_code == status.HTTP_200_OK

    # ---------------------------------------------------------
    # 5. ORG ADMIN Access
    # ---------------------------------------------------------
    def test_org_admin_has_full_access(self):
        self.client.force_authenticate(user=self.admin)
        assert self.client.get("/api/v1/dashboard/overview").status_code == status.HTTP_200_OK
        assert self.client.get("/api/v1/projects").status_code == status.HTTP_200_OK
        assert self.client.get("/api/v1/employees").status_code == status.HTTP_200_OK
        assert self.client.get("/api/v1/attendance").status_code == status.HTTP_200_OK
        assert self.client.get("/api/v1/dpr").status_code == status.HTTP_200_OK
        assert self.client.get("/api/v1/expenses").status_code == status.HTTP_200_OK
        assert self.client.get("/api/v1/payroll/payments").status_code == status.HTTP_200_OK
        assert self.client.get("/api/v1/ledger/transactions").status_code == status.HTTP_200_OK
        assert self.client.get("/api/v1/payroll/runs").status_code == status.HTTP_200_OK
        assert self.client.get("/api/v1/ledger/accounts").status_code == status.HTTP_200_OK
        assert self.client.get("/api/v1/users").status_code == status.HTTP_200_OK
