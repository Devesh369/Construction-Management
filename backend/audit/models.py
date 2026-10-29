from django.db import models

class AuditLog(models.Model):
    organization = models.IntegerField(default=10)
    created_at = models.DateTimeField(auto_now_add=True)
    actor = models.JSONField(default=list)
    action = models.CharField(max_length=120)
    resource_type = models.CharField(max_length=120)
    resource_id = models.CharField(max_length=120, blank=True, default='')
    changes = models.JSONField(default=dict, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(default='127.0.0.1')
    user_agent = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-created_at']
        db_table = 'audit_auditlog'
        indexes = [
            models.Index(fields=['action']),
            models.Index(fields=['resource_type']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        actor_str = self.actor[0] if self.actor else 'User'
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M')}] {actor_str} -> {self.action} ({self.resource_type} #{self.resource_id})"
