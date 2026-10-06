"""
Progress services: verification and project progress calculation.
"""

from decimal import Decimal

from django.db.models import Avg

from core.money import q2
from progress.models import DailyProgressReport, DPRStatus


def calculate_project_progress(project) -> Decimal:
    """
    Progress rule (v1): for each distinct task_name take latest VERIFIED percent_complete;
    Project.progress_percent = simple average across tasks (rounded to 2 dp).
    """
    avg_progress = (
        DailyProgressReport.objects.filter(project=project, status=DPRStatus.VERIFIED)
        .values("tasks__task_name")
        .aggregate(avg=Avg("tasks__percent_complete"))["avg"]
    )
    new_progress = q2(avg_progress) if avg_progress is not None else Decimal("0.00")
    project.progress_percent = new_progress
    project.save(update_fields=["progress_percent", "updated_at"])
    return new_progress
