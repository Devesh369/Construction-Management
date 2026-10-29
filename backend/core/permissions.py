"""
Permission classes for multi-tenancy and role-based access control.
"""

from rest_framework import permissions


class IsTenantUser(permissions.BasePermission):
    """
    Ensures the user is authenticated and belongs to an active tenant organization.
    Platform superusers (who have organization=None) are rejected from tenant APIs.
    """

    message = "You must belong to an active organization to access this resource."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        # Superusers use Django admin only, rejected by tenant API
        if getattr(user, "is_superuser", False) and getattr(user, "organization", None) is None:
            return False

        return getattr(user, "organization", None) is not None


def roles_required(*allowed_roles):
    """
    Factory function that returns a DRF Permission class checking user.role.
    Usage:
        permission_classes = [roles_required("ORG_ADMIN", "PROJECT_MANAGER")]
    """
    from core.roles import Role

    expanded = set(allowed_roles)
    # SITE_MANAGER and PROJECT_MANAGER share identical privileges
    if any(r in expanded for r in [Role.PROJECT_MANAGER, "PROJECT_MANAGER", Role.SITE_MANAGER, "SITE_MANAGER"]):
        expanded.add(Role.PROJECT_MANAGER)
        expanded.add("PROJECT_MANAGER")
        expanded.add(Role.SITE_MANAGER)
        expanded.add("SITE_MANAGER")

    if any(r in expanded for r in [Role.EMPLOYEE, "employee/labour", "EMPLOYEE", "LABOUR"]):
        expanded.add(Role.EMPLOYEE)
        expanded.add("employee/labour")
        expanded.add("EMPLOYEE")
        expanded.add("LABOUR")

    class RolePermission(permissions.BasePermission):
        message = f"Action requires one of the following roles: {', '.join(str(r) for r in allowed_roles)}."

        def has_permission(self, request, view):
            if not request.user or not request.user.is_authenticated:
                return False
            user_role = getattr(request.user, "role", None)
            return user_role in expanded

    return RolePermission
