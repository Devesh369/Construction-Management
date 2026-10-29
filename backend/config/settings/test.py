"""
Test settings for automated test suite.
"""

from .base import *  # noqa: F403
from .base import REST_FRAMEWORK  # noqa: F401

DEBUG = False
ALLOWED_HOSTS = ["*"]
SECRET_KEY = "django-insecure-test-key-for-running-pytest-suite-only-12345"

# Password hashing speedup for tests
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# Disable throttling during test execution
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {
    "auth": "1000/min",
}

# In-memory email backend for inspecting sent emails in tests
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
