import pytest
from django.core.exceptions import ValidationError
from django.db import DatabaseError, connection

from accounts.services import create_organization
from audit.constants import AuditAction
from audit.models import AuditLog


@pytest.mark.django_db
class TestAuditModels:
    def setup_method(self):
        self.org, _, _ = create_organization("Audit Test Org", "admin@audit.test")
        self.log_entry = AuditLog.objects.create(
            organization=self.org,
            action=AuditAction.LOGIN_SUCCESS,
            resource_type="User",
            resource_id="1",
            changes={"status": "active"},
        )

    def test_audit_log_instance_cannot_be_updated(self):
        """AuditLog.save() on existing row raises ValidationError."""
        self.log_entry.action = AuditAction.LOGOUT
        with pytest.raises(ValidationError, match="Immutable records cannot be updated"):
            self.log_entry.save()

    def test_audit_log_instance_cannot_be_deleted(self):
        """AuditLog.delete() raises ValidationError."""
        with pytest.raises(ValidationError, match="Immutable records cannot be deleted"):
            self.log_entry.delete()

    def test_audit_log_queryset_update_blocked(self):
        """AuditLog queryset .update() raises ValidationError."""
        with pytest.raises(ValidationError, match="Immutable records cannot be updated"):
            AuditLog.objects.filter(id=self.log_entry.id).update(action="HACKED")

    def test_audit_log_queryset_delete_blocked(self):
        """AuditLog queryset .delete() raises ValidationError."""
        with pytest.raises(ValidationError, match="Immutable records cannot be deleted"):
            AuditLog.objects.filter(id=self.log_entry.id).delete()

    def test_database_trigger_blocks_raw_update_and_delete(self):
        """PostgreSQL database trigger blocks raw SQL UPDATE and DELETE on audit table."""
        with connection.cursor() as cursor:
            # Raw SQL UPDATE
            with pytest.raises(DatabaseError):
                cursor.execute(
                    "UPDATE audit_auditlog SET action = 'HACKED' WHERE id = %s",
                    [self.log_entry.id],
                )

            # Raw SQL DELETE
            with pytest.raises(DatabaseError):
                cursor.execute(
                    "DELETE FROM audit_auditlog WHERE id = %s",
                    [self.log_entry.id],
                )
