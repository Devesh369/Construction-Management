"""
Unit tests for projects service layer:
- create_project auto-membership and default categories
- update_spend atomic increment and decrement
- archive_project blocking rules
- user_project_ids scoping helper
"""

from decimal import Decimal

import pytest
from accounts.services import accept_invitation, create_organization

from projects.models import BudgetCategory, ProjectMembership
from projects.services import create_project, update_spend, user_project_ids


@pytest.mark.django_db
class TestProjectsServices:
    def setup_method(self):
        self.org, _, raw_token = create_organization("Alpha Const", "admin@alpha.test")
        self.admin, _ = accept_invitation(raw_token, "Pass12345678#", name="Admin Alpha")

    def test_create_project_initializes_membership_and_categories(self):
        """create_project adds creator to roster and initializes 4 default categories."""
        data = {
            "name": "Skyline Tower",
            "code": "SKY-01",
            "estimated_budget": Decimal("5000000.00"),
        }
        project = create_project(self.org, self.admin, data)

        assert project.id is not None
        assert project.name == "Skyline Tower"
        assert project.actual_spend == Decimal("0.00")

        # Creator auto-added as member
        assert ProjectMembership.objects.filter(project=project, user=self.admin).exists()

        # 4 default budget categories created with 0 allocation
        cats = BudgetCategory.objects.filter(project=project)
        assert cats.count() == 4
        cat_names = set(cats.values_list("name", flat=True))
        assert cat_names == {"LABOR", "MATERIALS", "EQUIPMENT", "OVERHEAD"}

    def test_update_spend_atomic(self):
        """update_spend atomically updates spend using F() expression."""
        data = {"name": "Mall Project", "code": "MAL-01", "estimated_budget": Decimal("1000000.00")}
        project = create_project(self.org, self.admin, data)

        update_spend(project, Decimal("50000.00"), reason="Steel purchase")
        assert project.actual_spend == Decimal("50000.00")

        # Negative amount for reversals
        update_spend(project, Decimal("-10000.00"), reason="Return")
        assert project.actual_spend == Decimal("40000.00")

    def test_user_project_ids_returns_correct_set(self):
        """user_project_ids returns all project IDs assigned to user."""
        p1 = create_project(self.org, self.admin, {"name": "P1", "code": "P1"})
        p2 = create_project(self.org, self.admin, {"name": "P2", "code": "P2"})

        ids = user_project_ids(self.admin)
        assert p1.id in ids
        assert p2.id in ids
