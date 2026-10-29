from core.roles import Role
from rest_framework import permissions


class IsOrgAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None) == Role.ORG_ADMIN
        )
