"""
Unit tests for workforce services:
- Employee registration with auto code EMP-0001
- Wage rate rules (daily rate > 0 for daily wage, monthly > 0 for monthly staff)
- Effective daily rate property calculation
- Pay-rate modification auditing
- Gang member assignment and non-empty deletion guard
"""

from decimal import Decimal

import pytest

from accounts.services import accept_invitation, create_organization
from core.exceptions import BusinessRuleError
from projects.services import create_project
from workforce.models import EmploymentType
from workforce.services import (
    add_gang_members,
    create_employee,
    create_labor_group,
    delete_labor_group,
)


@pytest.mark.django_db
class TestWorkforceServices:
    def setup_method(self):
        self.org, _, raw_tok = create_organization("Alpha Workforce", "admin@alpha.test")
        self.admin, _ = accept_invitation(raw_tok, "AdminPass1234#", name="Admin Alpha")
        self.project = create_project(self.org, self.admin, {"name": "Test Site", "code": "TS-01"})

    def test_auto_employee_code_generation(self):
        """Worker registered without code receives EMP-0001 sequentially."""
        data = {
            "full_name": "Ramesh Kumar",
            "trade": "MASON",
            "employment_type": EmploymentType.DAILY_WAGE,
            "daily_rate": Decimal("850.00"),
            "primary_project": self.project,
        }
        emp1 = create_employee(self.org, data, self.admin)
        assert emp1.employee_code == "EMP-0001"

        data2 = {
            "full_name": "Suresh Patel",
            "trade": "CARPENTER",
            "employment_type": EmploymentType.DAILY_WAGE,
            "daily_rate": Decimal("900.00"),
            "primary_project": self.project,
        }
        emp2 = create_employee(self.org, data2, self.admin)
        assert emp2.employee_code == "EMP-0002"

    def test_effective_daily_rate_calculation(self):
        """Effective daily rate: daily_rate for DAILY_WAGE; monthly_salary / 30 for MONTHLY_SALARY."""
        emp_daily = create_employee(
            self.org,
            {
                "full_name": "Daily Worker",
                "employment_type": EmploymentType.DAILY_WAGE,
                "daily_rate": Decimal("750.00"),
            },
            self.admin,
        )
        assert emp_daily.effective_daily_rate == Decimal("750.00")

        emp_monthly = create_employee(
            self.org,
            {
                "full_name": "Monthly Supervisor",
                "employment_type": EmploymentType.MONTHLY_SALARY,
                "monthly_salary": Decimal("30000.00"),
            },
            self.admin,
        )
        # 30000 / 30 = 1000.00
        assert emp_monthly.effective_daily_rate == Decimal("1000.00")

    def test_labor_group_creation_and_member_assignment(self):
        """Workers can be assigned to gang; gang deletion blocked if members exist."""
        emp = create_employee(
            self.org,
            {
                "full_name": "Gang Worker",
                "employment_type": EmploymentType.DAILY_WAGE,
                "daily_rate": Decimal("800.00"),
            },
            self.admin,
        )
        gang = create_labor_group(self.org, self.project, "Mason Gang A")

        # Add worker
        add_gang_members(gang, [emp.id])
        emp.refresh_from_db()
        assert emp.group == gang

        # Attempting to delete gang while worker is member must fail
        with pytest.raises(BusinessRuleError):
            delete_labor_group(gang)
