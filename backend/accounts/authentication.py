"""
Custom JWT Authentication class checking token_version against current user state.
"""

from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class TokenVersionJWTAuthentication(JWTAuthentication):
    """
    Extends SimpleJWT to enforce token_version validation.
    If the user's password changes, account is deactivated, or session is revoked,
    the user's token_version is incremented in DB, immediately invalidating old tokens.
    """

    def get_user(self, validated_token):
        user = super().get_user(validated_token)

        # Check if user has been soft-deleted or deactivated
        if getattr(user, "deleted_at", None) is not None or not user.is_active:
            raise AuthenticationFailed(
                "User account is inactive or disabled.", code="user_inactive"
            )

        # Check token_version claim
        token_version_in_jwt = validated_token.get("token_version")
        if token_version_in_jwt is not None and token_version_in_jwt != user.token_version:
            raise AuthenticationFailed(
                "Token has been invalidated. Please log in again.", code="token_invalidated"
            )

        return user


class TokenVersionJWTScheme(OpenApiAuthenticationExtension):
    target_class = "accounts.authentication.TokenVersionJWTAuthentication"
    name = "jwtAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
