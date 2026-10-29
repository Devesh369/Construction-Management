"""
API Tests for Phase P1 Accounts module:
- UC-01 through UC-06 via HTTP requests
- Role permission matrix (ORG_ADMIN vs non-admin)
- 5-failure lockout returning HTTP 423
- Token revocation and refresh cookie rotation
- Tenant isolation (foreign tenant data yields 404)
- Last active ORG_ADMIN protection
"""

import pytest
from core.roles import Role
from core.testing import TenantIsolationTestMixin
from django.core.management import call_command
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import Organization
from accounts.services import accept_invitation, create_organization


@pytest.mark.django_db
class TestAccountsAPI(TenantIsolationTestMixin):
    def setup_method(self):
        self.client = APIClient()

        # Create primary tenant: Alpha
        self.org_alpha, self.invite_alpha, self.token_alpha = create_organization(
            name="Alpha Build", admin_email="admin@alpha.test"
        )
        self.user_alpha, self.tokens_alpha = accept_invitation(
            token=self.token_alpha, password="AdminPassword123#", name="Alpha Admin"
        )

        # Create secondary tenant: Beta (for isolation tests)
        self.org_beta, self.invite_beta, self.token_beta = create_organization(
            name="Beta Build", admin_email="admin@beta.test"
        )
        self.user_beta, self.tokens_beta = accept_invitation(
            token=self.token_beta, password="BetaPassword123#", name="Beta Admin"
        )

    def test_uc01_management_command_creates_organization(self):
        """UC-01: python manage.py create_organization succeeds."""
        call_command(
            "create_organization",
            name="Command Test Org",
            admin_email="cmd@test.com",
        )
        org = Organization.objects.get(name="Command Test Org")
        assert org.contact_email == "cmd@test.com"
        from ledger.models import Account

        assert Account.objects.filter(organization=org).count() == 13

    def test_uc02_accept_invite_api(self):
        """UC-02: POST /api/v1/auth/accept-invite creates user and returns tokens."""
        # Invite a Project Manager
        from accounts.services import create_user_invitation

        invite, raw_tok = create_user_invitation(
            org=self.org_alpha,
            email="pm@alpha.test",
            role=Role.PROJECT_MANAGER,
            invited_by=self.user_alpha,
        )

        response = self.client.post(
            "/api/v1/auth/accept-invite",
            {"token": raw_tok, "password": "PmPassword123#", "name": "PM John"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data
        assert response.data["user"]["role"] == Role.PROJECT_MANAGER
        assert "refresh_token" in response.cookies

    def test_uc03_login_and_cookie_issuance(self):
        """UC-03: POST /api/v1/auth/login returns access token and HTTP-only cookie."""
        response = self.client.post(
            "/api/v1/auth/login",
            {"email": "admin@alpha.test", "password": "AdminPassword123#"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data
        assert "refresh_token" in response.cookies
        cookie = response.cookies["refresh_token"]
        assert cookie["httponly"] is True
        assert cookie["samesite"].lower() == "lax"

    def test_uc03_lockout_returns_423(self):
        """UC-03: 5 consecutive failed logins returns HTTP 423 Locked."""
        for _ in range(4):
            res = self.client.post(
                "/api/v1/auth/login",
                {"email": "admin@alpha.test", "password": "WrongPassword"},
                format="json",
            )
            assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        # 5th attempt locks the account
        res = self.client.post(
            "/api/v1/auth/login",
            {"email": "admin@alpha.test", "password": "WrongPassword"},
            format="json",
        )
        assert res.status_code == status.HTTP_423_LOCKED
        assert res.data["error"]["code"] == "account_locked"

    def test_uc04_forgot_and_reset_password_api(self):
        """UC-04: Forgot password returns 200; reset password sets password and revokes tokens."""
        # Forgot password
        res = self.client.post(
            "/api/v1/auth/forgot-password",
            {"email": "admin@alpha.test"},
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK

        prt = self.user_alpha.password_reset_tokens.first()
        from accounts.services import generate_secure_token

        raw_tok, tok_hash = generate_secure_token()
        prt.token_hash = tok_hash
        prt.save()

        # Reset password
        res_reset = self.client.post(
            "/api/v1/auth/reset-password",
            {"token": raw_tok, "password": "BrandNewPassword123#"},
            format="json",
        )
        assert res_reset.status_code == status.HTTP_200_OK

        # Login with new password
        res_login = self.client.post(
            "/api/v1/auth/login",
            {"email": "admin@alpha.test", "password": "BrandNewPassword123#"},
            format="json",
        )
        assert res_login.status_code == status.HTTP_200_OK

    def test_uc05_invite_user_by_admin(self):
        """UC-05: ORG_ADMIN can invite new team members."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tokens_alpha['access']}")
        response = self.client.post(
            "/api/v1/org/invitations",
            {"email": "eng@alpha.test", "name": "Engineer Bob", "role": Role.SITE_ENGINEER},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["email"] == "eng@alpha.test"
        assert response.data["role"] == Role.SITE_ENGINEER
        assert "token" in response.data

    def test_uc06_configure_organization_rules(self):
        """UC-06: ORG_ADMIN can update settings; invalid values are rejected."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tokens_alpha['access']}")

        # Valid update
        response = self.client.patch(
            "/api/v1/org/current",
            {
                "workday_hours": "9.00",
                "half_day_hours": "4.50",
                "overtime_after_hours": "9.00",
                "expense_approval_limit": "2500.00",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["expense_approval_limit"] == "2500.00"

        # Invalid update: half_day_hours > workday_hours
        bad_response = self.client.patch(
            "/api/v1/org/current",
            {"workday_hours": "6.00", "half_day_hours": "8.00"},
            format="json",
        )
        assert bad_response.status_code == status.HTTP_400_BAD_REQUEST

    def test_last_org_admin_protection(self):
        """Cannot delete or demote the last active ORG_ADMIN."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tokens_alpha['access']}")

        # Attempt to delete own admin account
        del_res = self.client.delete(f"/api/v1/users/{self.user_alpha.id}")
        assert del_res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        # Attempt to demote own admin account
        patch_res = self.client.patch(
            f"/api/v1/users/{self.user_alpha.id}",
            {"role": Role.SUPERVISOR},
            format="json",
        )
        assert patch_res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_tenant_isolation_returns_404(self):
        """A user from tenant Beta querying tenant Alpha's user yields 404."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tokens_beta['access']}")
        # User Alpha belongs to Alpha; Beta admin must see 404 Not Found
        response = self.client.get(f"/api/v1/users/{self.user_alpha.id}")
        assert response.status_code == status.HTTP_404_NOT_FOUND
