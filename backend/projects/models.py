"""
Projects, site memberships, and budget categories models.
"""

from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from core.models import TenantModel


class ProjectStatus(models.TextChoices):
    PLANNING = "PLANNING", "Planning"
    ACTIVE = "ACTIVE", "Active"
    ON_HOLD = "ON_HOLD", "On Hold"
    COMPLETED = "COMPLETED", "Completed"
    ARCHIVED = "ARCHIVED", "Archived"


class Project(TenantModel):
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=30)
    client_name = models.CharField(max_length=200, blank=True)
    client_phone = models.CharField(max_length=30, blank=True)
    location = models.TextField(blank=True)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=ProjectStatus.choices,
        default=ProjectStatus.PLANNING,
    )
    start_date = models.DateField(null=True, blank=True)
    expected_end_date = models.DateField(null=True, blank=True)

    estimated_budget = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    actual_spend = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    progress_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00")), MaxValueValidator(Decimal("100.00"))],
    )

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("organization", "code")
        indexes = [
            models.Index(fields=["organization", "status"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"


class ProjectMembership(TenantModel):
    """Associates a user to a project with a specific site role."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="project_memberships"
    )
    site_role = models.CharField(max_length=50, blank=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("project", "user")

    def __str__(self):
        return f"{self.user} @ {self.project}"


class BudgetCategory(TenantModel):
    """Allocated spend categories for a project (Labor, Materials, etc.)."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="budget_categories")
    name = models.CharField(max_length=100)
    allocated_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("project", "name")

    def __str__(self):
        return f"{self.project.code} - {self.name}: {self.allocated_amount}"
