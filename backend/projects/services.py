"""
Projects service contracts.
Contracts:
- update_spend(project, amount: Decimal, reason: str) -> Project
- create_project(org, user, data) -> Project
- user_project_ids(user) -> set[int]
"""

from decimal import Decimal

from django.db import transaction
from django.db.models import F

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


def create_project(org, user, data: dict) -> Project:
    """
    Create a project, auto-add creator as member, and initialize default budget categories.
    """
    with transaction.atomic():
        project = Project.objects.create(
            organization=org,
            name=data["name"],
            code=data["code"],
            client_name=data.get("client_name", ""),
            location=data.get("location", ""),
            status=data.get("status", "PLANNING"),
            start_date=data.get("start_date"),
            expected_end_date=data.get("expected_end_date"),
            estimated_budget=data.get("estimated_budget", Decimal("0.00")),
            geofence_lat=data.get("geofence_lat"),
            geofence_lng=data.get("geofence_lng"),
            geofence_radius_m=data.get("geofence_radius_m", 200),
        )

        # Auto-add creator as member
        ProjectMembership.objects.create(
            organization=org,
            project=project,
            user=user,
            site_role="Creator / Manager",
        )

        # Create default budget categories
        for cat_name in DEFAULT_BUDGET_CATEGORIES:
            BudgetCategory.objects.create(
                organization=org,
                project=project,
                name=cat_name,
                allocated_amount=Decimal("0.00"),
            )

        return project


def user_project_ids(user) -> set[int]:
    """
    Return set of project IDs that user has membership for.
    Used by ProjectScopedMixin across the entire application.
    """
    if not user or not user.is_authenticated:
        return set()
    return set(ProjectMembership.objects.filter(user=user).values_list("project_id", flat=True))
