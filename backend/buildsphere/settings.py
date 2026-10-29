"""
BuildSphere settings module.
Inherits all full application configuration from config.settings.dev.
"""

from config.settings.dev import *  # noqa: F403

ROOT_URLCONF = "buildsphere.urls"
