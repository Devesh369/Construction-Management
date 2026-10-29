from django.db import models


class Role(models.TextChoices):
    ORG_ADMIN = "ORG_ADMIN", "Org Admin"
    SITE_MANAGER = "SITE_MANAGER", "Site Manager"
    PROJECT_MANAGER = "PROJECT_MANAGER", "Project Manager"
    EMPLOYEE = "employee/labour", "Employee / Labour"
    SITE_ENGINEER = "SITE_ENGINEER", "Site Engineer"
    SUPERVISOR = "SUPERVISOR", "Supervisor"
    ACCOUNTANT = "ACCOUNTANT", "Accountant"
