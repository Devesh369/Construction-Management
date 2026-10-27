"""
Accounts and Authentication Views:
- Login, Refresh, Logout with HTTP-only cookie support
- Invitation onboarding and acceptance
- Password recovery and reset
- User management and last-admin protection
- Tenant settings configuration
"""

from rest_framework import status, views
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from django.db import transaction
from accounts.models import Invitation, Organization, User


class SystemStatusView(views.APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"initialized": User.objects.exists()})


class SetupAdminView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        if User.objects.exists():
            return Response(
                {"error": {"code": "already_initialized", "message": "System has already been initialized."}},
                status=status.HTTP_403_FORBIDDEN,
            )

        org_name = request.data.get("org_name", "").strip() or "BuildSphere Construction"
        name = request.data.get("name", "").strip()
        email = request.data.get("email", "").lower().strip()
        password = request.data.get("password", "").strip()

        if not name or not email or not password:
            return Response(
                {"error": {"code": "validation_error", "message": "Full Name, Work Email, and Password are required."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(password) < 6:
            return Response(
                {"error": {"code": "validation_error", "message": "Password must be at least 6 characters."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from ledger.services import create_default_chart_of_accounts

        with transaction.atomic():
            org, _ = Organization.objects.get_or_create(
                name=org_name,
                defaults={"contact_email": email, "currency": "INR"},
            )
            create_default_chart_of_accounts(org)

            user = User.objects.create_user(
                email=email,
                password=password,
                name=name,
                organization=org,
                role=Role.ORG_ADMIN,
                is_staff=True,
                is_active=True,
            )

        user, tokens = login_user(email=email, password=password, request=request)
        user_data = {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "organization": {
                "id": user.organization.id if user.organization else None,
                "name": user.organization.name if user.organization else None,
            },
        }

        response = Response(
            {
                "access": tokens["access"],
                "user": user_data,
                "message": "System initialized and admin account created successfully!",
            },
            status=status.HTTP_201_CREATED,
        )
        set_refresh_cookie(response, tokens["refresh"])
        return response


from accounts.serializers import (
    AcceptInviteSerializer,
    ChangePasswordSerializer,
    CreateInvitationSerializer,
    ForgotPasswordSerializer,
    InvitationSerializer,
    LoginSerializer,
    OrganizationSerializer,
    ResetPasswordSerializer,
    UserProfileSerializer,
    UserSerializer,
)
from accounts.services import (
    accept_invitation,
    change_password,
    create_user_invitation,
    login_user,
    logout_user,
    refresh_user_token,
    request_password_reset,
    reset_password,
)
from audit.constants import AuditAction
from audit.services import log_action
from core.exceptions import BusinessRuleError
from core.permissions import IsTenantUser, roles_required
from core.roles import Role
from core.views import TenantViewSet


def set_refresh_cookie(response: Response, refresh_token: str):
    """Set refresh token as HTTP-only SameSite=Lax cookie."""
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=7 * 24 * 60 * 60,  # 7 days
        httponly=True,
        samesite="Lax",
        path="/api/v1/auth/",
    )


class LoginView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user, tokens = login_user(
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
            request=request,
        )

        user_data = {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "organization": {
                "id": user.organization.id if user.organization else None,
                "name": user.organization.name if user.organization else None,
            },
        }

        response = Response(
            {
                "access": tokens["access"],
                "user": user_data,
            },
            status=status.HTTP_200_OK,
        )
        set_refresh_cookie(response, tokens["refresh"])
        return response


class RefreshView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # Read from HTTP-only cookie, or fallback to body
        refresh_str = request.COOKIES.get("refresh_token") or request.data.get("refresh")
        if not refresh_str:
            raise BusinessRuleError("Refresh token not provided.", code="token_required")

        tokens = refresh_user_token(refresh_str)
        response = Response({"access": tokens["access"]}, status=status.HTTP_200_OK)
        set_refresh_cookie(response, tokens["refresh"])
        return response


class LogoutView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_str = request.COOKIES.get("refresh_token") or request.data.get("refresh")
        logout_user(refresh_str, user=request.user, request=request)
        response = Response({"message": "Successfully logged out."}, status=status.HTTP_200_OK)
        response.delete_cookie("refresh_token", path="/api/v1/auth/")
        return response


class AcceptInviteView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = AcceptInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user, tokens = accept_invitation(
            token=serializer.validated_data["token"],
            password=serializer.validated_data["password"],
            name=serializer.validated_data.get("name", ""),
            request=request,
        )

        user_data = {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "organization": {
                "id": user.organization.id,
                "name": user.organization.name,
            },
        }

        response = Response(
            {
                "access": tokens["access"],
                "user": user_data,
            },
            status=status.HTTP_200_OK,
        )
        set_refresh_cookie(response, tokens["refresh"])
        return response


class ForgotPasswordView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request_password_reset(serializer.validated_data["email"], request=request)
        return Response(
            {"message": "If the email is registered, a password recovery link has been sent."},
            status=status.HTTP_200_OK,
        )


class ResetPasswordView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reset_password(
            token=serializer.validated_data["token"],
            new_password=serializer.validated_data["password"],
            request=request,
        )
        return Response(
            {
                "message": "Password has been successfully reset. Please log in with your new password."
            },
            status=status.HTTP_200_OK,
        )


class ChangePasswordView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tokens = change_password(
            user=request.user,
            old_password=serializer.validated_data["old_password"],
            new_password=serializer.validated_data["new_password"],
            request=request,
        )
        response = Response({"access": tokens["access"]}, status=status.HTTP_200_OK)
        set_refresh_cookie(response, tokens["refresh"])
        return response


class UserProfileView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class UserViewSet(TenantViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsTenantUser, roles_required(Role.ORG_ADMIN)]
    filterset_fields = ["role", "is_active"]
    search_fields = ["name", "email", "phone"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return User.objects.none()
        return User.objects.filter(
            organization=self.request.user.organization,
            deleted_at__isnull=True,
        ).order_by("-created_at")

    def perform_create(self, serializer):
        password = serializer.validated_data.pop("password", None) or "Pass@12345"
        role = serializer.validated_data.get("role", Role.PROJECT_MANAGER)
        user = serializer.save(
            organization=self.request.user.organization,
            is_staff=(role == Role.ORG_ADMIN),
            is_active=True,
        )
        user.set_password(password)
        user.save()

        log_action(
            user=self.request.user,
            action=AuditAction.USER_CREATED,
            obj=user,
            request=self.request,
            organization=self.request.user.organization,
        )

    def perform_update(self, serializer):
        user_to_update = self.get_object()
        new_role = serializer.validated_data.get("role")
        new_is_active = serializer.validated_data.get("is_active")

        # Self-protection rule: cannot demote or deactivate the last active ORG_ADMIN
        if user_to_update.role == Role.ORG_ADMIN:
            if (new_role and new_role != Role.ORG_ADMIN) or (new_is_active is False):
                active_admins_count = (
                    User.objects.filter(
                        organization=user_to_update.organization,
                        role=Role.ORG_ADMIN,
                        is_active=True,
                        deleted_at__isnull=True,
                    )
                    .exclude(id=user_to_update.id)
                    .count()
                )
                if active_admins_count == 0:
                    raise BusinessRuleError(
                        "Cannot demote or deactivate the last active ORG_ADMIN of this organization.",
                        code="last_admin_protection",
                    )

        old_role = user_to_update.role
        updated_user = serializer.save()

        # If role changed, bump token_version immediately to revoke old permissions
        if new_role and new_role != old_role:
            updated_user.token_version += 1
            updated_user.save(update_fields=["token_version"])

        log_action(
            user=self.request.user,
            action=AuditAction.USER_UPDATED,
            obj=updated_user,
            changes=serializer.validated_data,
            request=self.request,
            organization=self.request.user.organization,
        )

    def perform_destroy(self, instance):
        # Self-protection rule: cannot delete the last active ORG_ADMIN
        if instance.role == Role.ORG_ADMIN:
            active_admins_count = (
                User.objects.filter(
                    organization=instance.organization,
                    role=Role.ORG_ADMIN,
                    is_active=True,
                    deleted_at__isnull=True,
                )
                .exclude(id=instance.id)
                .count()
            )
            if active_admins_count == 0:
                raise BusinessRuleError(
                    "Cannot delete the last active ORG_ADMIN of this organization.",
                    code="last_admin_protection",
                )

        # Invalidate sessions and soft-delete
        instance.token_version += 1
        super().perform_destroy(instance)

        log_action(
            user=self.request.user,
            action=AuditAction.USER_DELETED,
            obj=instance,
            request=self.request,
            organization=self.request.user.organization,
        )


class OrganizationCurrentView(views.APIView):
    permission_classes = [IsAuthenticated, IsTenantUser]

    def get(self, request):
        serializer = OrganizationSerializer(request.user.organization)
        return Response(serializer.data)

    def patch(self, request):
        if request.user.role != Role.ORG_ADMIN:
            return Response(
                {
                    "error": {
                        "code": "permission_denied",
                        "message": "Only ORG_ADMIN can update organization settings.",
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = OrganizationSerializer(
            request.user.organization, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        updated_org = serializer.save()

        log_action(
            user=request.user,
            action=AuditAction.ORG_SETTINGS_UPDATED,
            obj=updated_org,
            changes=serializer.validated_data,
            request=request,
            organization=updated_org,
        )
        return Response(serializer.data)


class InvitationViewSet(TenantViewSet):
    queryset = Invitation.objects.all()
    serializer_class = InvitationSerializer
    permission_classes = [IsAuthenticated, IsTenantUser, roles_required(Role.ORG_ADMIN)]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Invitation.objects.none()
        return Invitation.objects.filter(organization=self.request.user.organization).order_by("-created_at")

    def create(self, request, *args, **kwargs):
        serializer = CreateInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation, raw_token = create_user_invitation(
            org=request.user.organization,
            email=serializer.validated_data["email"],
            role=serializer.validated_data["role"],
            name=serializer.validated_data.get("name", ""),
            invited_by=request.user,
            request=request,
        )
        res_data = InvitationSerializer(invitation).data
        # Return token in response for convenience in testing and API usage
        res_data["token"] = raw_token
        return Response(res_data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="resend")
    def resend(self, request, pk=None):
        invitation = self.get_object()
        from datetime import timedelta

        from django.utils import timezone

        from accounts.services import generate_secure_token

        raw_token, token_hash = generate_secure_token()
        invitation.token_hash = token_hash
        invitation.expires_at = timezone.now() + timedelta(days=7)
        invitation.save(update_fields=["token_hash", "expires_at"])
        return Response({"status": "resent", "token": raw_token})
