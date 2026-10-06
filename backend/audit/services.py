"""
Audit trail services.
Contract:
log_action(user, action, obj=None, changes=None, request=None, organization=None, metadata=None) -> AuditLog
"""

from audit.models import AuditLog


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
        changes=changes or {},
        metadata=metadata or {},
        ip_address=ip_address,
        user_agent=user_agent,
    )
