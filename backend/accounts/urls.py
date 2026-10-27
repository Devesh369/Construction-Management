from django.urls import include, path
from rest_framework.routers import DefaultRouter

from accounts.views import (
    AcceptInviteView,
    ChangePasswordView,
    ForgotPasswordView,
    InvitationViewSet,
    LoginView,
    LogoutView,
    OrganizationCurrentView,
    RefreshView,
    ResetPasswordView,
    SetupAdminView,
    SystemStatusView,
    UserProfileView,
    UserViewSet,
)

router = DefaultRouter(trailing_slash=False)
router.register(r"users", UserViewSet, basename="users")
router.register(r"org/invitations", InvitationViewSet, basename="org-invitations")

urlpatterns = [
    # Auth endpoints
    path("auth/system-status", SystemStatusView.as_view(), name="auth-system-status"),
    path("auth/setup-admin", SetupAdminView.as_view(), name="auth-setup-admin"),
    path("auth/login", LoginView.as_view(), name="auth-login"),
    path("auth/refresh", RefreshView.as_view(), name="auth-refresh"),
    path("auth/logout", LogoutView.as_view(), name="auth-logout"),
    path("auth/accept-invite", AcceptInviteView.as_view(), name="auth-accept-invite"),
    path("auth/forgot-password", ForgotPasswordView.as_view(), name="auth-forgot-password"),
    path("auth/reset-password", ResetPasswordView.as_view(), name="auth-reset-password"),
    path("auth/change-password", ChangePasswordView.as_view(), name="auth-change-password"),
    # Users profile
    path("users/me", UserProfileView.as_view(), name="users-me"),
    # Organization settings
    path("org/current", OrganizationCurrentView.as_view(), name="org-current"),
    # ViewSet routes
    path("", include(router.urls)),
]
