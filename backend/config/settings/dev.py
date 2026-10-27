"""
Development settings.
"""

from .base import *  # noqa: F403

DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "testserver"]

# Ensure console email backend for testing invites and password reset in dev
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
