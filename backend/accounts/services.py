"""
Accounts business services:
- Organization creation and chart of accounts seeding
- Invitation generation and acceptance
- Password recovery and reset
- Account lockout handling (5 failed attempts -> 30 min lock)
- Token-version based JWT generation and revocation
"""

import hashlib
import secrets
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Invitation, Organization, PasswordResetToken, User
from audit.constants import AuditAction
from audit.services import log_action
from core.exceptions import (
    AccountLockedError,
    BusinessRuleError,
    ConflictError,
)
from core.roles import Role


def hash_token(token: str) -> str:
    """Hash raw token string with SHA-256."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_secure_token() -> tuple[str, str]:
    """Generate 32-byte urlsafe token and its SHA-256 hash."""
    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_token(raw_token)
    return raw_token, token_hash


def get_tokens_for_user(user: User) -> dict:
    """
    Generate SimpleJWT access and refresh tokens stamped with:
    sub (user id), org_id, role, and token_version.
    """
    refresh = RefreshToken.for_user(user)

    # Add custom claims as specified in Section 2.4
    refresh["org_id"] = user.organization_id if user.organization else None
    refresh["role"] = user.role
    refresh["token_version"] = user.token_version

    access_token = refresh.access_token
    access_token["org_id"] = user.organization_id if user.organization else None
    access_token["role"] = user.role
    access_token["token_version"] = user.token_version

    return {
        "access": str(access_token),
        "refresh": str(refresh),
    }


def create_organization(name: str, admin_email: str) -> tuple[Organization, Invitation, str]:
    """
    UC-01: Create tenant organization, default chart of accounts, and ORG_ADMIN invitation.
    """
    admin_email = admin_email.lower().strip()
    if Organization.objects.filter(name=name).exists():
        raise ConflictError(f"Organization with name '{name}' already exists.")

    from ledger.services import create_default_chart_of_accounts

    with transaction.atomic():
        org = Organization.objects.create(
            name=name,
            contact_email=admin_email,
            currency="INR",
            workday_hours=Decimal("8.00"),
            half_day_hours=Decimal("4.00"),
            overtime_after_hours=Decimal("8.00"),
            night_shift_multiplier=Decimal("1.50"),
            expense_approval_limit=Decimal("1000.00"),
        )

        # 1. Seed the 13 default accounts in double-entry ledger
        create_default_chart_of_accounts(org)

        # 2. Generate invitation for the first ORG_ADMIN
        raw_token, token_hash = generate_secure_token()
        invitation = Invitation.objects.create(
            organization=org,
            email=admin_email,
            name="Admin",
            role=Role.ORG_ADMIN,
            token_hash=token_hash,
            expires_at=timezone.now() + timedelta(days=7),
        )

        # Send invite email (in dev console, in prod SMTP)
        invite_url = f"{settings.FRONTEND_URL}/accept-invite?token={raw_token}"
        send_mail(
            subject=f"Welcome to {org.name} - Complete your registration",
            message=f"You have been invited to set up {org.name}.\n\nClick link to activate: {invite_url}",
            from_email="no-reply@constructionportal.internal",
            recipient_list=[admin_email],
            fail_silently=True,
        )

    return org, invitation, raw_token


def accept_invitation(token: str, password: str, name: str = "", request=None) -> tuple[User, dict]:
    """
    UC-02: Accept an invitation token, create user account, mark token used, and log in.
    """
    token_h = hash_token(token)
    try:
        invitation = Invitation.objects.select_related("organization").get(token_hash=token_h)
    except Invitation.DoesNotExist:
        raise BusinessRuleError("Invalid or expired invitation token.", code="invalid_token")

    if not invitation.is_valid():
        raise BusinessRuleError(
            "This invitation has already been used or has expired.", code="invalid_token"
        )

    # Check if a user with this email already exists
    if User.objects.filter(email=invitation.email).exists():
        raise ConflictError("A user with this email address is already registered.")

    full_name = name.strip() or invitation.name or "User"

    with transaction.atomic():
        user = User.objects.create_user(
            email=invitation.email,
            password=password,
            name=full_name,
            role=invitation.role,
            organization=invitation.organization,
        )

        invitation.used_at = timezone.now()
        invitation.save(update_fields=["used_at"])

        log_action(
            user=user,
            action=AuditAction.USER_CREATED,
            obj=user,
            changes={
                "email": {"old": None, "new": user.email},
                "role": {"old": None, "new": user.role},
            },
            request=request,
            organization=user.organization,
        )

        tokens = get_tokens_for_user(user)

    return user, tokens


def login_user(email: str, password: str, request=None) -> tuple[User, dict]:
    """
    UC-03: Authenticate email + password with 5-failure lockout and JWT issuance.
    """
    email_clean = email.lower().strip()
    try:
        user = User.objects.select_related("organization").get(email=email_clean)
    except User.DoesNotExist:
        raise BusinessRuleError("Invalid email or password.", code="invalid_credentials")

    now = timezone.now()

    # 1. Check account lockout state
    if user.locked_until and user.locked_until > now:
        raise AccountLockedError()

    # If lock has expired, reset counter
    if user.locked_until and user.locked_until <= now:
        user.failed_login_count = 0
        user.locked_until = None
        user.save(update_fields=["failed_login_count", "locked_until"])

    # 2. Check password
    if not user.check_password(password):
        user.failed_login_count += 1
        if user.failed_login_count >= 5:
            user.locked_until = now + timedelta(minutes=30)
            user.save(update_fields=["failed_login_count", "locked_until"])
            log_action(
                user=user,
                action=AuditAction.LOGIN_FAILED,
                obj=user,
                metadata={"reason": "Account locked after 5 consecutive failures"},
                request=request,
                organization=user.organization,
            )
            raise AccountLockedError()
        else:
            user.save(update_fields=["failed_login_count"])
            log_action(
                user=user,
                action=AuditAction.LOGIN_FAILED,
                obj=user,
                metadata={"failed_attempts": user.failed_login_count},
                request=request,
                organization=user.organization,
            )
            raise BusinessRuleError("Invalid email or password.", code="invalid_credentials")

    # 3. Successful login resets counters
    if user.failed_login_count > 0 or user.locked_until:
        user.failed_login_count = 0
        user.locked_until = None
        user.save(update_fields=["failed_login_count", "locked_until"])

    log_action(
        user=user,
        action=AuditAction.LOGIN_SUCCESS,
        obj=user,
        request=request,
        organization=user.organization,
    )

    tokens = get_tokens_for_user(user)
    return user, tokens


def refresh_user_token(refresh_token_str: str) -> dict:
    """
    Rotate refresh token and issue new access token.
    """
    try:
        refresh = RefreshToken(refresh_token_str)
        user_id = refresh.payload.get("user_id")
        user = User.objects.get(id=user_id)

        # Check token version
        if refresh.payload.get("token_version") != user.token_version:
            raise BusinessRuleError(
                "Session has been invalidated. Please log in again.", code="token_invalidated"
            )

        # Rotate refresh token
        tokens = get_tokens_for_user(user)
        # Blacklist old refresh token
        try:
            refresh.blacklist()
        except Exception:
            pass

        return tokens
    except TokenError:
        raise BusinessRuleError("Invalid or expired refresh token.", code="invalid_token")


def logout_user(refresh_token_str: str, user=None, request=None):
    """
    Blacklist refresh token and write audit record.
    """
    if refresh_token_str:
        try:
            token = RefreshToken(refresh_token_str)
            token.blacklist()
        except TokenError:
            pass

    if user and user.is_authenticated:
        log_action(
            user=user,
            action=AuditAction.LOGOUT,
            obj=user,
            request=request,
            organization=getattr(user, "organization", None),
        )


def request_password_reset(email: str, request=None) -> bool:
    """
    UC-04: Request password recovery link. Always returns True (generic 200).
    """
    email_clean = email.lower().strip()
    try:
        user = User.objects.get(email=email_clean, is_active=True)
    except User.DoesNotExist:
        return True

    raw_token, token_hash = generate_secure_token()
    expires_at = timezone.now() + timedelta(hours=1)

    PasswordResetToken.objects.create(
        user=user,
        token_hash=token_hash,
        expires_at=expires_at,
    )

    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"
    send_mail(
        subject="Password Reset Request",
        message=f"Hello {user.name},\n\nClick link to reset your password (valid for 1 hour):\n{reset_url}",
        from_email="no-reply@constructionportal.internal",
        recipient_list=[user.email],
        fail_silently=True,
    )
    return True


def reset_password(token: str, new_password: str, request=None) -> User:
    """
    UC-04: Set new password, bump token_version (revokes all active JWTs), mark token used.
    """
    token_h = hash_token(token)
    try:
        prt = PasswordResetToken.objects.select_related("user", "user__organization").get(
            token_hash=token_h
        )
    except PasswordResetToken.DoesNotExist:
        raise BusinessRuleError("Invalid or expired password reset link.", code="invalid_token")

    if not prt.is_valid():
        raise BusinessRuleError(
            "This password reset link has already been used or expired.", code="invalid_token"
        )

    user = prt.user
    with transaction.atomic():
        user.set_password(new_password)
        user.token_version += 1  # Invalidate all prior access tokens
        user.failed_login_count = 0
        user.locked_until = None
        user.save(update_fields=["password", "token_version", "failed_login_count", "locked_until"])

        prt.used_at = timezone.now()
        prt.save(update_fields=["used_at"])

        log_action(
            user=user,
            action=AuditAction.PASSWORD_RESET,
            obj=user,
            request=request,
            organization=user.organization,
        )

    return user


def change_password(user: User, old_password: str, new_password: str, request=None) -> dict:
    """
    Change password for authenticated user. Bumps token_version and returns new tokens.
    """
    if not user.check_password(old_password):
        raise BusinessRuleError("Current password does not match.", code="invalid_password")

    with transaction.atomic():
        user.set_password(new_password)
        user.token_version += 1
        user.save(update_fields=["password", "token_version"])

        log_action(
            user=user,
            action=AuditAction.PASSWORD_CHANGED,
            obj=user,
            request=request,
            organization=user.organization,
        )

        tokens = get_tokens_for_user(user)

    return tokens


def create_user_invitation(
    org: Organization, email: str, role: str, invited_by: User, name: str = "", request=None
) -> tuple[Invitation, str]:
    """
    UC-05: Invite a new user with an assigned role. Audited.
    """
    email_clean = email.lower().strip()
    if User.objects.filter(email=email_clean).exists():
        raise ConflictError(f"A user with email '{email_clean}' already exists.")

    raw_token, token_hash = generate_secure_token()
    expires_at = timezone.now() + timedelta(days=7)

    with transaction.atomic():
        invitation = Invitation.objects.create(
            organization=org,
            email=email_clean,
            name=name.strip(),
            role=role,
            token_hash=token_hash,
            expires_at=expires_at,
            invited_by=invited_by,
        )

        log_action(
            user=invited_by,
            action=AuditAction.USER_INVITED,
            obj=invitation,
            changes={
                "email": {"old": None, "new": invitation.email},
                "role": {"old": None, "new": invitation.role},
            },
            request=request,
            organization=org,
        )

        invite_url = f"{settings.FRONTEND_URL}/accept-invite?token={raw_token}"
        send_mail(
            subject=f"Invitation to join {org.name}",
            message=f"Hello,\n\nYou have been invited to join {org.name} as {role}.\n\nAccept invite:\n{invite_url}",
            from_email="no-reply@constructionportal.internal",
            recipient_list=[email_clean],
            fail_silently=True,
        )

    return invitation, raw_token
