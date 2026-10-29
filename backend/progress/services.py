"""
Progress services: DPR verification, rejection, and project progress percentage calculation.
"""

from decimal import Decimal

from audit.constants import AuditAction
from audit.services import log_action
from core.exceptions import BusinessRuleError
from core.money import q2
from django.db import transaction
from django.utils import timezone

from progress.models import DailyProgressReport, DPRStatus, TaskProgress


def calculate_project_progress(project) -> Decimal:
    """
    Progress rule (v1): for each distinct task_name take the latest VERIFIED percent_complete;
    Project.progress_percent = simple average across tasks (rounded to 2 dp).
    """
    verified_tasks = (
        TaskProgress.objects.filter(
            report__project=project,
            report__status=DPRStatus.VERIFIED,
        )
        .order_by("-report__report_date", "-id")
        .select_related("report")
    )

    latest_task_percents = {}
    for task in verified_tasks:
        if task.task_name not in latest_task_percents:
            latest_task_percents[task.task_name] = task.percent_complete

    if not latest_task_percents:
        new_progress = Decimal("0.00")
    else:
        total = sum(latest_task_percents.values(), Decimal("0.00"))
        new_progress = q2(total / Decimal(len(latest_task_percents)))

    project.progress_percent = new_progress
    project.save(update_fields=["progress_percent", "updated_at"])
    return new_progress


def verify_dpr(user, dpr: DailyProgressReport, request=None) -> DailyProgressReport:
    """
    UC-17: PM verifies a DPR. Recalculates project progress percent and logs audit action.
    """
    if dpr.status == DPRStatus.VERIFIED:
        raise BusinessRuleError("Report is already verified.", code="already_verified")

    with transaction.atomic():
        dpr.status = DPRStatus.VERIFIED
        dpr.verified_by = user
        dpr.verified_at = timezone.now()
        dpr.rejection_reason = ""
        dpr.save(
            update_fields=["status", "verified_by", "verified_at", "rejection_reason", "updated_at"]
        )

        calculate_project_progress(dpr.project)

        log_action(
            user=user,
            action=AuditAction.DPR_VERIFIED,
            obj=dpr,
            changes={
                "status": DPRStatus.VERIFIED,
                "project_progress": str(dpr.project.progress_percent),
            },
            request=request,
            organization=dpr.organization,
        )

    return dpr


def reject_dpr(user, dpr: DailyProgressReport, reason: str, request=None) -> DailyProgressReport:
    """
    UC-17: PM rejects a DPR with a mandatory reason.
    """
    if not reason or not reason.strip():
        raise BusinessRuleError(
            "A reason is mandatory when rejecting a DPR.", code="reason_required"
        )

    with transaction.atomic():
        dpr.status = DPRStatus.REJECTED
        dpr.rejection_reason = reason
        dpr.save(update_fields=["status", "rejection_reason", "updated_at"])

        log_action(
            user=user,
            action=AuditAction.DPR_REJECTED,
            obj=dpr,
            changes={"status": DPRStatus.REJECTED, "reason": reason},
            request=request,
            organization=dpr.organization,
        )

    return dpr
