from django.db import models


class Role(models.TextChoices):
    ORG_ADMIN = "ORG_ADMIN", "Org Admin"
    PROJECT_MANAGER = "PROJECT_MANAGER", "Project Manager"
    SITE_ENGINEER = "SITE_ENGINEER", "Site Engineer"
    SUPERVISOR = "SUPERVISOR", "Supervisor"
    ACCOUNTANT = "ACCOUNTANT", "Accountant"
