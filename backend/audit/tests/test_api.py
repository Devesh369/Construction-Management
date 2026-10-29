import pytest
from accounts.services import accept_invitation, create_organization, create_user_invitation
from core.roles import Role
from rest_framework import status
from rest_framework.test import APIClient

from audit.constants import AuditAction
from audit.models import AuditLog


@pytest.mark.django_db
class TestAuditAPI:
    def setup_method(self):
        self.client = APIClient()

        # Tenant Alpha
        self.org_alpha, _, tok_admin_a = create_organization("Alpha Corp", "admin@alpha.test")
        self.admin_alpha, self.tokens_alpha = accept_invitation(
            tok_admin_a, "AlphaAdmin123#", "Alpha Admin"
        )

        # Create Accountant in Alpha
        _, tok_acc = create_user_invitation(
            self.org_alpha,
            "acc@alpha.test",
            Role.ACCOUNTANT,
            self.admin_alpha,
            name="Alpha Accountant",
        )
        self.acc_alpha, self.tokens_acc = accept_invitation(
            tok_acc, "AlphaAcc123#", "Alpha Accountant"
        )

        # Tenant Beta
        self.org_beta, _, tok_admin_b = create_organization("Beta Corp", "admin@beta.test")
        self.admin_beta, self.tokens_beta = accept_invitation(
            tok_admin_b, "BetaAdmin123#", "Beta Admin"
        )

        # Create audit logs in Alpha and Beta
        self.log_a = AuditLog.objects.create(
            organization=self.org_alpha,
            actor=self.admin_alpha,
            action=AuditAction.PROJECT_CREATED,
            resource_type="Project",
            resource_id="101",
            changes={"name": "Project Alpha 1"},
        )
        self.log_b = AuditLog.objects.create(
            organization=self.org_beta,
            actor=self.admin_beta,
            action=AuditAction.PROJECT_CREATED,
            resource_type="Project",
            resource_id="201",
            changes={"name": "Project Beta 1"},
        )

    def test_uc30_admin_can_list_audit_logs(self):
        """UC-30: ORG_ADMIN can list and search audit logs."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tokens_alpha['access']}")
        res = self.client.get("/api/v1/audit-logs")
        assert res.status_code == status.HTTP_200_OK
        results = res.data.get("results", res.data)
        assert len(results) >= 1
        assert any(item["id"] == self.log_a.id for item in results)

    def test_audit_logs_tenant_isolation(self):
        """Alpha admin cannot view Beta's audit logs in list or detail."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tokens_alpha['access']}")

        # List should not contain Beta's log
        res = self.client.get("/api/v1/audit-logs")
        results = res.data.get("results", res.data)
        beta_ids = [item["id"] for item in results if item["id"] == self.log_b.id]
        assert len(beta_ids) == 0

        # Detail for Beta's log should return 404
        res_detail = self.client.get(f"/api/v1/audit-logs/{self.log_b.id}")
        assert res_detail.status_code == status.HTTP_404_NOT_FOUND

    def test_non_admin_roles_forbidden(self):
        """Non-admin roles like ACCOUNTANT receive 403 Forbidden."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tokens_acc['access']}")
        res = self.client.get("/api/v1/audit-logs")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_request_unauthorized(self):
        """Unauthenticated request receives 401 Unauthorized."""
        res = self.client.get("/api/v1/audit-logs")
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_filter_by_action_and_resource(self):
        """Filtering by action and resource_type returns matching entries."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tokens_alpha['access']}")
        res = self.client.get(
            f"/api/v1/audit-logs?action={AuditAction.PROJECT_CREATED}&resource_type=Project"
        )
        assert res.status_code == status.HTTP_200_OK
        results = res.data.get("results", res.data)
        assert len(results) >= 1
        for item in results:
            assert item["action"] == AuditAction.PROJECT_CREATED
            assert item["resource_type"] == "Project"
