"""
Daily Progress Report (DPR) models: tasks, materials, and photos.
"""

from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from core.models import TenantModel


class DPRStatus(models.TextChoices):
    SUBMITTED = "SUBMITTED", "Submitted"
    VERIFIED = "VERIFIED", "Verified"
    REJECTED = "REJECTED", "Rejected"


class DailyProgressReport(TenantModel):
    """Single daily progress report per project and date."""

    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="dprs")
    report_date = models.DateField()
    submitted_by = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="submitted_dprs"
    )
    weather = models.CharField(max_length=50, blank=True)
    summary = models.TextField()
    issues = models.TextField(blank=True)

    status = models.CharField(max_length=20, choices=DPRStatus.choices, default=DPRStatus.SUBMITTED)
    verified_by = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="verified_dprs",
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["-report_date"]
        unique_together = ("project", "report_date")
        indexes = [
            models.Index(fields=["organization", "project", "report_date"]),
        ]

    def __str__(self):
        return f"{self.project.code} DPR {self.report_date} ({self.status})"


class TaskProgress(TenantModel):
    """Progress percentage for a specific site work item."""

    report = models.ForeignKey(DailyProgressReport, on_delete=models.CASCADE, related_name="tasks")
    task_name = models.CharField(max_length=200)
    percent_complete = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00")), MaxValueValidator(Decimal("100.00"))],
    )
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.task_name}: {self.percent_complete}%"


class MaterialUsage(TenantModel):
    """Quantity of construction material consumed."""

    report = models.ForeignKey(
        DailyProgressReport, on_delete=models.CASCADE, related_name="materials"
    )
    task = models.ForeignKey(
        TaskProgress,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="materials_used",
    )
    material_name = models.CharField(max_length=100)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit = models.CharField(max_length=20)

    def __str__(self):
        return f"{self.material_name}: {self.quantity} {self.unit}"


class SitePhoto(TenantModel):
    """Photographic evidence captured on site."""

    report = models.ForeignKey(DailyProgressReport, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="dpr_photos/")
    caption = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return f"Photo for DPR {self.report_id}"
