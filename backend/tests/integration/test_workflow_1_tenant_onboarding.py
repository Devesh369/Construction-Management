"""
End-to-End Acceptance Test for Workflow 1: Tenant Onboarding and Setup (Phase P8).
Covers:
1. Superuser runs create_organization: Organization + chart of accounts + ORG_ADMIN invitation.
2. ORG_ADMIN accepts invite (POST /api/v1/auth/accept-invite) and adjusts settings (PATCH /api/v1/org/current).
3. ORG_ADMIN invites PM, ENG, SUP, and ACC users (POST /api/v1/org/invitations); each accepts.
4. PM creates a project (POST /api/v1/projects) with budget + geofence and assigns members.
5. SUP registers workers (POST /api/v1/employees) and creates gangs (POST /api/v1/labor-groups).
6. ADM/PM adds holidays (POST /api/v1/holidays).
"""

from decimal import Decimal

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from accounts.services import create_organization
from attendance.models import Holiday
from core.roles import Role
from projects.models import Project, ProjectMembership
from workforce.models import Employee, LaborGroup


@pytest.mark.django_db
class TestWorkflow1TenantOnboarding:
    def setup_method(self):
        self.client = APIClient()

    def test_workflow_1_full_lifecycle(self):
        # ----------------------------------------------------------------------
        # Step 1: Organization Creation via Service / Management Command
        # ----------------------------------------------------------------------
        org, invite, raw_token = create_organization(
            name="Apex Infrastructure Ltd",
            admin_email="admin@apexinfra.test",
        )
        assert org.name == "Apex Infrastructure Ltd"
        assert invite.role == Role.ORG_ADMIN
        # Default chart of accounts seeded
        from ledger.models import Account

        assert Account.objects.filter(organization=org).count() == 13

        # ----------------------------------------------------------------------
        # Step 2: ORG_ADMIN Accepts Invite & Adjusts Org Settings
        # ----------------------------------------------------------------------
        accept_res = self.client.post(
            "/api/v1/auth/accept-invite",
            {
                "token": raw_token,
                "password": "ApexAdmin123#",
                "name": "Aarav Mehta",
            },
            format="json",
        )
        assert accept_res.status_code == status.HTTP_200_OK
        assert "access" in accept_res.data

        admin_token = accept_res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

        # Adjust Organization Settings: 8h workday, 15,000 approval limit
        patch_org_res = self.client.patch(
            "/api/v1/org/current",
            {
                "workday_hours": "8.00",
                "expense_approval_limit": "15000.00",
            },
            format="json",
        )
        assert patch_org_res.status_code == status.HTTP_200_OK
        org.refresh_from_db()
        assert org.expense_approval_limit == Decimal("15000.00")

        # ----------------------------------------------------------------------
        # Step 3: ORG_ADMIN Invites PM, ENG, SUP, ACC & Each Accepts
        # ----------------------------------------------------------------------
        team_members = [
            ("pm@apexinfra.test", Role.PROJECT_MANAGER, "Priya Sharma", "PMSecret123#"),
            ("eng@apexinfra.test", Role.SITE_ENGINEER, "Rohan Gupta", "EngSecret123#"),
            ("sup@apexinfra.test", Role.SUPERVISOR, "Sanjay Patil", "SupSecret123#"),
            ("acc@apexinfra.test", Role.ACCOUNTANT, "Ananya Desai", "AccSecret123#"),
        ]

        user_tokens = {}

        for email, role, name, pwd in team_members:
            inv_res = self.client.post(
                "/api/v1/org/invitations",
                {"email": email, "role": role, "name": name},
                format="json",
            )
            assert inv_res.status_code == status.HTTP_201_CREATED
            raw_tok = inv_res.data["token"]

            unauth_client = APIClient()
            acc_res = unauth_client.post(
                "/api/v1/auth/accept-invite",
                {"token": raw_tok, "password": pwd, "name": name},
                format="json",
            )
            assert acc_res.status_code == status.HTTP_200_OK
            user_tokens[role] = acc_res.data["access"]

        assert len(user_tokens) == 4

        # ----------------------------------------------------------------------
        # Step 4: PM Creates Project with Budget & Assigns Members
        # ----------------------------------------------------------------------
        pm_client = APIClient()
        pm_client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_tokens[Role.PROJECT_MANAGER]}")

        proj_res = pm_client.post(
            "/api/v1/projects",
            {
                "name": "Skyline Heights",
                "code": "PRJ-SKY",
                "estimated_budget": "50000000.00",
                "status": "ACTIVE",
            },
            format="json",
        )
        assert proj_res.status_code == status.HTTP_201_CREATED
        project_id = proj_res.data["id"]

        project_obj = Project.objects.get(id=project_id)
        assert project_obj.estimated_budget == Decimal("50000000.00")

        # PM assigns Site Engineer and Supervisor
        sup_user = User.objects.get(email="sup@apexinfra.test")
        mem_res = pm_client.post(
            f"/api/v1/projects/{project_id}/members",
            {"user_id": sup_user.id, "site_role": "Site Supervisor"},
            format="json",
        )
        assert mem_res.status_code == status.HTTP_201_CREATED
        assert ProjectMembership.objects.filter(project=project_obj, user=sup_user).exists()

        # ----------------------------------------------------------------------
        # Step 5: SUP Registers Workers & Creates Gangs
        # ----------------------------------------------------------------------
        sup_client = APIClient()
        sup_client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_tokens[Role.SUPERVISOR]}")

        # Register worker
        emp_res = sup_client.post(
            "/api/v1/employees",
            {
                "full_name": "Ramesh Kumar",
                "employee_code": "EMP-001",
                "trade": "MASON",
                "daily_rate": "800.00",
                "primary_project": project_id,
            },
            format="json",
        )
        assert emp_res.status_code == status.HTTP_201_CREATED
        worker_id = emp_res.data["id"]

        # Register second worker
        emp2_res = sup_client.post(
            "/api/v1/employees",
            {
                "full_name": "Suresh Singh",
                "employee_code": "EMP-002",
                "trade": "CARPENTER",
                "daily_rate": "850.00",
                "primary_project": project_id,
            },
            format="json",
        )
        assert emp2_res.status_code == status.HTTP_201_CREATED
        worker2_id = emp2_res.data["id"]

        # Create Labor Group
        gang_res = sup_client.post(
            "/api/v1/labor-groups",
            {
                "name": "Civil Works Gang",
                "project": project_id,
                "leader": worker_id,
            },
            format="json",
        )
        assert gang_res.status_code == status.HTTP_201_CREATED
        gang_id = gang_res.data["id"]

        # Add worker to gang
        add_mem_res = sup_client.post(
            f"/api/v1/labor-groups/{gang_id}/members",
            {"employee_ids": [worker2_id]},
            format="json",
        )
        assert add_mem_res.status_code == status.HTTP_200_OK

        # ----------------------------------------------------------------------
        # Step 6: ADM / PM Adds Organization Holiday
        # ----------------------------------------------------------------------
        holiday_res = pm_client.post(
            "/api/v1/holidays",
            {
                "name": "Republic Day",
                "date": "2026-01-26",
                "holiday_type": "NATIONAL",
                "is_paid": True,
            },
            format="json",
        )
        assert holiday_res.status_code == status.HTTP_201_CREATED
        assert Holiday.objects.filter(organization=org, name="Republic Day").exists()

        # Final verification of onboarding state
        assert User.objects.filter(organization=org).count() == 5
        assert Project.objects.filter(organization=org).count() == 1
        assert Employee.objects.filter(organization=org).count() == 2
        assert LaborGroup.objects.filter(organization=org).count() == 1
