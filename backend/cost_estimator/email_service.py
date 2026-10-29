import logging
import os

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def send_credentials_email(recipient_email, name, role, raw_password, login_url=None):
    """
    Sends an onboarding email with system credentials to a newly created team member.
    Tries Resend API if RESEND_API_KEY is configured, else falls back to Django's configured EMAIL_BACKEND.
    """
    resend_api_key = os.environ.get("RESEND_API_KEY", "") or getattr(settings, "RESEND_API_KEY", "")
    from_email = os.environ.get("RESEND_FROM_EMAIL", "BuildSphere <onboarding@resend.dev>")
    portal_url = login_url or os.environ.get("FRONTEND_URL", "https://buildsphere.com")

    subject = f"Welcome to BuildSphere — Your Login Credentials ({name or recipient_email})"

    plain_text = f"""
Hello {name or 'Team Member'},

Your account has been set up on the BuildSphere Construction Management Platform.

YOUR LOGIN CREDENTIALS:
- Portal URL: {portal_url}
- Login Email: {recipient_email}
- Password: {raw_password}
- Assigned Role: {role}

Please sign in and change your password upon initial login.

Best regards,
BuildSphere Team
    """.strip()

    html_content = f"""
    <div style="font-family: sans-serif; max-width: 580px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #0284c7;">Welcome to BuildSphere</h2>
      <p>Hello <strong>{name or 'Team Member'}</strong>,</p>
      <p>Your account has been created on the BuildSphere Construction Management Platform with the role of <strong>{role}</strong>.</p>
      <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #cbd5e1; margin: 20px 0;">
        <p style="margin: 4px 0;"><strong>Portal URL:</strong> <a href="{portal_url}">{portal_url}</a></p>
        <p style="margin: 4px 0;"><strong>Username:</strong> {recipient_email}</p>
        <p style="margin: 4px 0;"><strong>Password:</strong> <code style="background: #fff; padding: 2px 6px; border: 1px solid #ddd;">{raw_password}</code></p>
        <p style="margin: 4px 0;"><strong>Assigned Role:</strong> {role}</p>
      </div>
      <p style="font-size: 12px; color: #64748b;">Please change your password upon first login under Settings.</p>
    </div>
    """

    # If Resend API key is present, try direct Resend API call
    if resend_api_key:
        try:
            import json
            import urllib.request

            req = urllib.request.Request(
                "https://api.resend.com/emails",
                data=json.dumps(
                    {
                        "from": from_email,
                        "to": [recipient_email],
                        "subject": subject,
                        "html": html_content,
                        "text": plain_text,
                    }
                ).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {resend_api_key}",
                    "Content-Type": "application/json",
                    "User-Agent": "BuildSphere/1.0",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                result = json.loads(response.read().decode("utf-8"))
                logger.info(f"Credentials email dispatched via Resend: {result.get('id')}")
                return {"success": True, "provider": "resend", "id": result.get("id")}
        except Exception as e:
            logger.warning(f"Resend API dispatch failed ({e}), falling back to Django send_mail.")

    # Fallback to Django send_mail
    try:
        sent_count = send_mail(
            subject=subject,
            message=plain_text,
            from_email=from_email,
            recipient_list=[recipient_email],
            html_message=html_content,
            fail_silently=False,
        )
        logger.info(f"Credentials email dispatched via Django send_mail to {recipient_email}")
        return {"success": True, "provider": "django_mail", "count": sent_count}
    except Exception as e:
        logger.error(f"Failed to dispatch credentials email: {e}")
        return {"success": False, "error": str(e)}
