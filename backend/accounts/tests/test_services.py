"""
Unit tests for accounts services:
- UC-01: Organization creation and chart of accounts seeding
- UC-02: Invitation onboarding and token hashing
- UC-03: Login, lockout after 5 failures, and token generation
- UC-04: Password recovery and token-version invalidation
- UC-05: Team invitations
"""

import pytest
from django.utils import timezone

from accounts.services import (
    accept_invitation,
    create_organization,
    login_user,
    request_password_reset,
    reset_password,
)
from core.exceptions import AccountLockedError, BusinessRuleError
from core.roles import Role
from ledger.models import Account


@pytest.mark.django_db
class TestAccountsServices:
    def test_uc01_create_organization_seeds_chart_of_accounts(self):
        """UC-01: create_organization creates org, 13 chart of accounts, and admin invite."""
        org, invite, raw_token = create_organization(
            name="Alpha Constructions",
            admin_email="admin@alpha.test",
        )
        assert org.id is not None
        assert org.name == "Alpha Constructions"
        assert org.currency == "INR"

        # Check default 13 accounts created in ledger
        accounts_count = Account.objects.filter(organization=org).count()
        assert accounts_count == 13

        # Check admin invitation
        assert invite.organization == org
        assert invite.email == "admin@alpha.test"
        assert invite.role == Role.ORG_ADMIN
        assert invite.is_valid()
        assert len(raw_token) > 20

    def test_uc02_accept_invitation_creates_user(self):
        """UC-02: accept_invitation creates user, marks invite used, and logs in."""
        org, invite, raw_token = create_organization("Beta Corp", "admin@beta.test")
        user, tokens = accept_invitation(
            token=raw_token,
            password="StrongPassword123#",
            name="Beta Admin",
        )
        assert user.email == "admin@beta.test"
        assert user.role == Role.ORG_ADMIN
        assert user.organization == org
        assert user.check_password("StrongPassword123#")

        # Invite is now used
        invite.refresh_from_db()
        assert invite.used_at is not None
        assert not invite.is_valid()

        # Reusing the token must fail
        with pytest.raises(BusinessRuleError):
            accept_invitation(token=raw_token, password="AnotherPassword123#")

    def test_uc03_login_lockout_after_five_failed_attempts(self):
        """UC-03: 5 failed logins locks account for 30 min (returns 423 AccountLockedError)."""
        org, invite, raw_token = create_organization("Gamma Ltd", "admin@gamma.test")
        user, _ = accept_invitation(raw_token, "CorrectPassword123#")

        # 4 failed attempts
        for _ in range(4):
            with pytest.raises(BusinessRuleError):
                login_user("admin@gamma.test", "WrongPassword")

        user.refresh_from_db()
        assert user.failed_login_count == 4
        assert user.locked_until is None

        # 5th failed attempt locks the account
        with pytest.raises(AccountLockedError):
            login_user("admin@gamma.test", "WrongPassword")

        user.refresh_from_db()
        assert user.failed_login_count == 5
        assert user.locked_until is not None
        assert user.locked_until > timezone.now()

        # Even with the CORRECT password, locked account is rejected
        with pytest.raises(AccountLockedError):
            login_user("admin@gamma.test", "CorrectPassword123#")

    def test_uc04_password_reset_revokes_old_tokens(self):
        """UC-04: reset_password increments token_version, invalidating previous sessions."""
        org, invite, raw_token = create_organization("Delta Inc", "admin@delta.test")
        user, _ = accept_invitation(raw_token, "OldPassword123#")
        initial_token_version = user.token_version

        # Request reset
        request_password_reset("admin@delta.test")
        prt = user.password_reset_tokens.first()
        assert prt is not None

        # Note: hash of token is stored, we can test with token hash or test reset
        from accounts.services import generate_secure_token

        raw_reset_token, token_hash = generate_secure_token()
        prt.token_hash = token_hash
        prt.save()

        user_reset = reset_password(raw_reset_token, "NewPassword123#")
        assert user_reset.token_version == initial_token_version + 1
        assert user_reset.check_password("NewPassword123#")

    def test_send_credentials_email_fallback(self):
        """Test send_credentials_email sends message to user's email or custom_email."""
        from django.core import mail

        from accounts.services import send_credentials_email

        org, invite, raw_token = create_organization("Email Test Org", "admin@emailtest.com")
        user, _ = accept_invitation(raw_token, "Pass#123456", name="Tester")

        mail.outbox.clear()
        res = send_credentials_email(
            user=user,
            password="TemporaryPassword123#",
            organization=org,
            custom_email="alternate@emailtest.com",
        )
        assert res is True
        assert len(mail.outbox) == 1
        sent = mail.outbox[0]
        assert "alternate@emailtest.com" in sent.to
        assert "TemporaryPassword123#" in sent.body
        assert "Email Test Org" in sent.subject
