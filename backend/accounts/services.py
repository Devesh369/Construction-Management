"""
Accounts services: user creation, tokens, organization setup.
"""

import hashlib
import secrets
from datetime import timedelta

from django.utils import timezone

from accounts.models import Invitation, Organization


def hash_token(token: str) -> str:
    """Hash raw token string with SHA-256."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_secure_token() -> tuple[str, str]:
    """Generate 32-byte urlsafe token and its SHA-256 hash."""
    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_token(raw_token)
    return raw_token, token_hash


def create_invitation(
    org: Organization, email: str, role: str, invited_by=None, name=""
) -> tuple[Invitation, str]:
    """Create a new team invitation for an organization."""
    raw_token, token_hash = generate_secure_token()
    expires_at = timezone.now() + timedelta(days=7)

    invitation = Invitation.objects.create(
        organization=org,
        email=email.lower(),
        name=name,
        role=role,
        token_hash=token_hash,
        expires_at=expires_at,
        invited_by=invited_by,
    )
    return invitation, raw_token
