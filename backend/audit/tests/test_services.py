import pytest
from accounts.services import accept_invitation, create_organization
from django.db import transaction
from django.test import RequestFactory

from audit.constants import AuditAction
from audit.models import AuditLog
from audit.services import log_action


@pytest.mark.django_db
class TestAuditServices:
    def setup_method(self):
        self.org, self.invite, self.token = create_organization(
            name="Audit Service Org", admin_email="auditadmin@test.com"
        )
        self.user, _ = accept_invitation(self.token, "Password123#", "Audit Admin")
        self.factory = RequestFactory()

    def test_log_action_creates_record(self):
        """log_action creates an append-only AuditLog record."""
        entry = log_action(
            user=self.user,
            action=AuditAction.PROJECT_CREATED,
            obj=self.org,
            changes={"name": {"old": "", "new": "Project X"}},
            metadata={"source": "api"},
        )
        assert entry is not None
        assert entry.organization == self.org
        assert entry.actor == self.user
        assert entry.action == AuditAction.PROJECT_CREATED
        assert entry.resource_type == "Organization"
        assert entry.resource_id == str(self.org.id)

    def test_log_action_masks_sensitive_fields(self):
        """Sensitive fields like passwords, tokens, and bank details are masked."""
        changes = {
            "password": "SecretPassword123",
            "token": "secret_jwt_token_abcdef123456",
            "bank_account_number": "987654321098",
            "id_proof_number": "123456789012",
            "normal_field": "safe_value",
        }
        entry = log_action(
            user=self.user,
            action=AuditAction.USER_UPDATED,
            changes=changes,
        )
        assert entry.changes["normal_field"] == "safe_value"
        assert entry.changes["password"].startswith("***")
        assert entry.changes["bank_account_number"] == "***1098"
        assert entry.changes["id_proof_number"] == "***9012"
        assert "SecretPassword123" not in str(entry.changes)

    def test_log_action_extracts_ip_and_user_agent(self):
        """Client IP and User-Agent are extracted from the HTTP request."""
        request = self.factory.get(
            "/api/v1/dummy",
            HTTP_X_FORWARDED_FOR="203.0.113.195, 70.41.3.18",
            HTTP_USER_AGENT="Mozilla/5.0 " + ("A" * 300),
        )
        entry = log_action(
            user=self.user,
            action=AuditAction.LOGIN_SUCCESS,
            request=request,
        )
        assert entry.ip_address == "203.0.113.195"
        assert len(entry.user_agent) == 255  # Truncated

    def test_log_action_transaction_rollback(self):
        """Audit log commits or rolls back with the caller's transaction."""
        initial_count = AuditLog.objects.count()
        try:
            with transaction.atomic():
                log_action(user=self.user, action=AuditAction.PROJECT_CREATED)
                raise RuntimeError("Force rollback")
        except RuntimeError:
            pass

        assert AuditLog.objects.count() == initial_count
