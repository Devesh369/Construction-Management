"""
Audit trail views. Read-only for ORG_ADMIN.
"""

from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from audit.filters import AuditLogFilter
from audit.models import AuditLog
from audit.serializers import AuditLogSerializer
from core.permissions import IsTenantUser, roles_required
from core.roles import Role


class AuditLogViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    Read-only viewset for viewing the immutable security audit log.
    Accessible only to ORG_ADMIN.
    """

    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsTenantUser, roles_required(Role.ORG_ADMIN)]
    filterset_class = AuditLogFilter
    search_fields = ["action", "resource_type", "resource_id", "actor__email"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated or not getattr(user, "organization", None):
            return AuditLog.objects.none()
        return AuditLog.objects.filter(organization=user.organization)
