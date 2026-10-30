from django.db import models


class Role(models.TextChoices):
    ORG_ADMIN = "ORG_ADMIN", "Org Admin"
    SITE_MANAGER = "SITE_MANAGER", "Site Manager / Project Manager"
    PROJECT_MANAGER = "PROJECT_MANAGER", "Project Manager"
    EMPLOYEE = "employee/labour", "Labour / Employee"


# Backward-compatibility aliases pointing to SITE_MANAGER
Role.SUPERVISOR = Role.SITE_MANAGER
Role.SITE_ENGINEER = Role.SITE_MANAGER
Role.ACCOUNTANT = Role.SITE_MANAGER
