"""
Base ViewSet and Mixins for tenant isolation and project membership scoping.
"""

from django.utils import timezone
from rest_framework import viewsets

from core.roles import Role


class TenantViewSet(viewsets.ModelViewSet):
    """
    Standard ModelViewSet that strictly enforces tenant data isolation.
    - Filters every queryset by request.user.organization.
    - Sets organization on creation from request.user.organization.
    - Soft-deletes objects upon deletion.
    - Returns 404 for records belonging to another tenant or non-existent IDs.
    """

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return super().get_queryset().none()

        qs = super().get_queryset()
        user = self.request.user
        if not user or not user.is_authenticated:
            return qs.none()

        org = getattr(user, "organization", None)
        if not org:
            return qs.none()

        return qs.filter(organization=org)

    def perform_create(self, serializer):
        # Always stamp tenant organization from the authenticated user
        serializer.save(organization=self.request.user.organization)

    def perform_destroy(self, instance):
        # Soft delete instead of hard delete
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at", "updated_at"])


class ProjectScopedMixin:
    """
    Mixin for ViewSets that need project-level scoping:
    - ORG_ADMIN and ACCOUNTANT see all organization records.
    - PROJECT_MANAGER, SITE_ENGINEER, and SUPERVISOR see only records for assigned projects.
    """

    project_field_name = "project"

    def filter_project_scope(self, queryset):
        user = self.request.user
        if not user or not user.is_authenticated:
            return queryset.none()

        role = getattr(user, "role", None)
        if role == Role.ORG_ADMIN:
            return queryset

        # Lazy import contract from projects app to avoid circular dependencies
        from projects.services import user_project_ids

        allowed_ids = user_project_ids(user)
        if queryset.model.__name__ == "Project" or self.project_field_name in ("self", "id"):
            return queryset.filter(id__in=allowed_ids)
        field_filter = {f"{self.project_field_name}_id__in": allowed_ids}
        return queryset.filter(**field_filter)
