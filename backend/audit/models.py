"""
AuditLog model: append-only immutable security and compliance audit trail.
"""

from django.db import models

from core.models import ImmutableTenantModel


class AuditLog(ImmutableTenantModel):
    """
    Append-only record of sensitive system events and state mutations.
    """

    actor = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=50)
    resource_type = models.CharField(max_length=50)
    resource_id = models.CharField(max_length=40)
    changes = models.JSONField(default=dict, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "created_at"]),
            models.Index(fields=["organization", "action"]),
            models.Index(fields=["organization", "actor"]),
        ]

    def __str__(self):
        return f"{self.created_at} - {self.action} on {self.resource_type}:{self.resource_id}"
