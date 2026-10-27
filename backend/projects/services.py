"""
Projects service layer.
Contracts:
- update_spend(project, amount: Decimal, reason: str) -> Project
- create_project(org, user, data) -> Project
- update_project(project, data, user, request=None) -> Project
- archive_project(project, user) -> Project
- user_project_ids(user) -> set[int]
"""

from decimal import Decimal

from django.db import transaction
from django.db.models import F

from audit.constants import AuditAction
from audit.services import log_action
from core.exceptions import BusinessRuleError
from core.money import q2
from projects.models import BudgetCategory, Project, ProjectMembership

DEFAULT_BUDGET_CATEGORIES = ["LABOR", "MATERIALS", "EQUIPMENT", "OVERHEAD"]


def update_spend(project: Project, amount: Decimal, reason: str = "") -> Project:
    """
    Update project actual_spend atomically using an F() expression.
    Amount may be negative for reversals/cancellations.
    """
    with transaction.atomic():
        Project.objects.filter(pk=project.pk).update(actual_spend=F("actual_spend") + amount)
        project.refresh_from_db(fields=["actual_spend"])
    return project


def create_project(org, user, data: dict, request=None) -> Project:
    """
    Create a project, auto-add creator PM/ADM as member, and initialize default budget categories.
    Audited with PROJECT_CREATED.
    """
    with transaction.atomic():
        project = Project.objects.create(
            organization=org,
            name=data["name"],
            code=data.get("code") or f"PRJ-{data['name'][:6].upper().replace(' ', '')}",
            client_name=data.get("client_name", ""),
            client_phone=data.get("client_phone", ""),
            location=data.get("location", ""),
            description=data.get("description", ""),
            status=data.get("status", "ACTIVE"),
            start_date=data.get("start_date"),
            expected_end_date=data.get("expected_end_date"),
            estimated_budget=q2(Decimal(str(data.get("estimated_budget") or "0.00"))),
            geofence_lat=data.get("geofence_lat"),
            geofence_lng=data.get("geofence_lng"),
            geofence_radius_m=data.get("geofence_radius_m", 200),
        )

        # Auto-add creator as member
        if user:
            ProjectMembership.objects.create(
                organization=org,
                project=project,
                user=user,
                site_role="Project Lead",
            )

        # Create default budget categories: LABOR, MATERIALS, EQUIPMENT, OVERHEAD
        for cat_name in DEFAULT_BUDGET_CATEGORIES:
            BudgetCategory.objects.create(
                organization=org,
                project=project,
                name=cat_name,
                allocated_amount=Decimal("0.00"),
            )

        log_action(
            user=user,
            action=AuditAction.PROJECT_CREATED,
            obj=project,
            changes={
                "name": {"old": None, "new": project.name},
                "code": {"old": None, "new": project.code},
                "estimated_budget": {"old": None, "new": str(project.estimated_budget)},
            },
            request=request,
            organization=org,
        )

        return project


def update_project(project: Project, data: dict, user, request=None) -> Project:
    """
    Update project attributes with audit logs for budget changes, geofence updates, and general edits.
    """
    old_budget = project.estimated_budget
    old_lat = project.geofence_lat
    old_lng = project.geofence_lng
    old_radius = project.geofence_radius_m

    with transaction.atomic():
        for field, value in data.items():
            if field in ["actual_spend", "progress_percent"]:
                continue  # read-only fields
            if field == "code" and not value:
                continue  # preserve existing code if empty
            if field == "estimated_budget":
                value = q2(Decimal(str(value if value is not None and value != "" else "0.00")))
            setattr(project, field, value)

        project.save()
        project.refresh_from_db()

        # Audit budget changes
        if "estimated_budget" in data and q2(data["estimated_budget"]) != old_budget:
            log_action(
                user=user,
                action=AuditAction.BUDGET_CHANGED,
                obj=project,
                changes={
                    "estimated_budget": {
                        "old": str(old_budget),
                        "new": str(project.estimated_budget),
                    }
                },
                request=request,
                organization=project.organization,
            )

        # Audit geofence changes
        if any(f in data for f in ["geofence_lat", "geofence_lng", "geofence_radius_m"]):
            log_action(
                user=user,
                action=AuditAction.GEOFENCE_CHANGED,
                obj=project,
                changes={
                    "geofence_lat": {"old": str(old_lat), "new": str(project.geofence_lat)},
                    "geofence_lng": {"old": str(old_lng), "new": str(project.geofence_lng)},
                    "geofence_radius_m": {
                        "old": str(old_radius),
                        "new": str(project.geofence_radius_m),
                    },
                },
                request=request,
                organization=project.organization,
            )

        log_action(
            user=user,
            action=AuditAction.PROJECT_UPDATED,
            obj=project,
            changes=data,
            request=request,
            organization=project.organization,
        )

    return project


def archive_project(project: Project, user, request=None) -> Project:
    """
    Archive a project. Blocked if any DRAFT payroll run or PENDING_APPROVAL expense exists.
    """
    from expenses.models import Expense
    from payroll.models import PayrollRun

    has_draft_payroll = PayrollRun.objects.filter(project=project, status="DRAFT").exists()
    if has_draft_payroll:
        raise BusinessRuleError(
            "Cannot archive project while DRAFT payroll runs exist.",
            code="archive_blocked_draft_payroll",
        )

    has_pending_expenses = Expense.objects.filter(
        project=project, status="PENDING_APPROVAL"
    ).exists()
    if has_pending_expenses:
        raise BusinessRuleError(
            "Cannot archive project while PENDING expenses exist.",
            code="archive_blocked_pending_expenses",
        )

    project.status = "ARCHIVED"
    project.save(update_fields=["status", "updated_at"])

    log_action(
        user=user,
        action=AuditAction.PROJECT_UPDATED,
        obj=project,
        changes={"status": {"old": "ACTIVE", "new": "ARCHIVED"}},
        request=request,
        organization=project.organization,
    )
    return project


def add_project_member(project: Project, user, site_role: str = "") -> ProjectMembership:
    """Add user as member to project."""
    membership, _ = ProjectMembership.objects.get_or_create(
        organization=project.organization,
        project=project,
        user=user,
        defaults={"site_role": site_role},
    )
    return membership


def remove_project_member(project: Project, user) -> bool:
    """Remove user membership from project."""
    count, _ = ProjectMembership.objects.filter(project=project, user=user).delete()
    return count > 0


def user_project_ids(user) -> set[int]:
    """
    Return set of project IDs that user has membership for.
    Used by ProjectScopedMixin across the entire application.
    """
    if not user or not user.is_authenticated:
        return set()
    return set(ProjectMembership.objects.filter(user=user).values_list("project_id", flat=True))
