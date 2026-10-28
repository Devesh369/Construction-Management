"""
Context processors for site branding and tenant metadata.
"""

from django.conf import settings


def site_branding(request):
    """
    Exposes site branding configuration to all Django templates and admin views.
    """
    return {
        "SITE_NAME": getattr(settings, "SITE_NAME", "BuildSphere"),
        "SITE_TAGLINE": getattr(settings, "SITE_TAGLINE", "Construction Management Platform"),
    }
