"""
Audit trail services.
Contract:
log_action(user, action, obj=None, changes=None, request=None, organization=None, metadata=None) -> AuditLog
"""

from datetime import date, datetime
from decimal import Decimal

from audit.models import AuditLog


def _make_json_safe(data):
    """Recursively convert Decimals, dates, and non-primitives to JSON-serializable types."""
    if isinstance(data, dict):
        return {k: _make_json_safe(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [_make_json_safe(item) for item in data]
    elif isinstance(data, Decimal):
        return str(data)
    elif isinstance(data, (date, datetime)):
        return data.isoformat()
    return data


def log_action(
    user,
    action: str,
    obj=None,
    changes=None,
    request=None,
    organization=None,
    metadata=None,
) -> AuditLog | None:
    """
    Append an entry to the organization's audit log.
    Extracts IP address and user-agent from request if provided.
    Runs inside the caller's database transaction.
    """
    target_org = organization
    if target_org is None and user is not None:
        target_org = getattr(user, "organization", None)
    if target_org is None and obj is not None:
        target_org = getattr(obj, "organization", None)

    if not target_org:
        # Without an organization, skip or cannot record tenant audit
        return None

    ip_address = None
    user_agent = ""
    if request:
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(",")[0].strip()
        else:
            ip_address = request.META.get("REMOTE_ADDR")
        raw_ua = request.META.get("HTTP_USER_AGENT", "")
        user_agent = raw_ua[:255] if raw_ua else ""

    resource_type = ""
    resource_id = ""
    if obj is not None:
        resource_type = obj.__class__.__name__
        resource_id = str(getattr(obj, "pk", ""))

    return AuditLog.objects.create(
        organization=target_org,
        actor=user if (user and getattr(user, "is_authenticated", False)) else None,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        changes=_make_json_safe(changes or {}),
        metadata=_make_json_safe(metadata or {}),
        ip_address=ip_address,
        user_agent=user_agent,
    )
