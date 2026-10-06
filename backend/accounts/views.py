"""
Accounts views: authentication, user management, and tenant settings endpoints.
"""

from rest_framework import status, views
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.models import Invitation, User
from accounts.serializers import (
    InvitationSerializer,
    OrganizationSerializer,
    UserProfileSerializer,
    UserSerializer,
)
from core.permissions import IsTenantUser, roles_required
from core.roles import Role
from core.views import TenantViewSet


class LoginView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        return Response({"message": "Login stub"}, status=status.HTTP_200_OK)


class RefreshView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        return Response({"message": "Refresh stub"}, status=status.HTTP_200_OK)


class LogoutView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response({"message": "Logout stub"}, status=status.HTTP_200_OK)


class AcceptInviteView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        return Response({"message": "Accept invite stub"}, status=status.HTTP_200_OK)


class ForgotPasswordView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        return Response({"message": "Forgot password stub"}, status=status.HTTP_200_OK)


class ResetPasswordView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        return Response({"message": "Reset password stub"}, status=status.HTTP_200_OK)


class ChangePasswordView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response({"message": "Change password stub"}, status=status.HTTP_200_OK)


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
    queryset = User.objects.filter(deleted_at__isnull=True)
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsTenantUser, roles_required(Role.ORG_ADMIN)]


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
                        "message": "Only ORG_ADMIN can update settings.",
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = OrganizationSerializer(
            request.user.organization, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class InvitationViewSet(TenantViewSet):
    queryset = Invitation.objects.all()
    serializer_class = InvitationSerializer
    permission_classes = [IsAuthenticated, IsTenantUser, roles_required(Role.ORG_ADMIN)]
