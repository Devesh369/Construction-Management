"""
Unit tests for dashboard services (Phase P7: Insight).
Tests KPI calculations, alerts, caching, scoping, and multi-tenancy.
"""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.cache import cache
from django.utils import timezone

from accounts.services import (
    accept_invitation,
    create_organization,
    create_user_invitation,
)
from attendance.models import Attendance, AttendanceStatus
from core.roles import Role
from dashboard.services import get_dashboard_overview, get_project_dashboard
from expenses.models import Expense, ExpenseCategory, ExpenseStatus, PaymentMode, Vendor
from ledger.models import Side
from ledger.services import post_journal_entry
from payroll.models import PayrollRun, PayrollRunStatus
from progress.models import DailyProgressReport, DPRStatus
from projects.models import ProjectStatus
from projects.services import add_project_member, create_project
from workforce.services import create_employee


@pytest.mark.django_db
class TestDashboardServices:
    def setup_method(self):
        cache.clear()

        # Organization Alpha
        self.org, _, self.token = create_organization("Alpha Builders", "admin@alpha.test")
        self.admin, _ = accept_invitation(self.token, "AdminPass123#", "Admin Alpha")

        pm_inv, pm_tok = create_user_invitation(
            self.org, "pm@alpha.test", Role.PROJECT_MANAGER, self.admin
        )
        self.pm, _ = accept_invitation(pm_tok, "PMPass123#", "PM Alpha")

        acc_inv, acc_tok = create_user_invitation(
            self.org, "acc@alpha.test", Role.ACCOUNTANT, self.admin
        )
        self.acc, _ = accept_invitation(acc_tok, "AccPass123#", "Acc Alpha")

        # Project 1 (assigned to PM)
        self.project1 = create_project(
            self.org,
            self.admin,
            {
                "name": "Tower A",
                "code": "PRJ-A",
                "estimated_budget": Decimal("100000.00"),
            },
        )
        self.project1.status = ProjectStatus.ACTIVE
        self.project1.save()
        add_project_member(self.project1, self.pm, site_role="Site PM")

        # Project 2 (not assigned to PM)
        self.project2 = create_project(
            self.org,
            self.admin,
            {
                "name": "Tower B",
                "code": "PRJ-B",
                "estimated_budget": Decimal("200000.00"),
            },
        )
        self.project2.status = ProjectStatus.ACTIVE
        self.project2.save()

        # Employees
        self.emp1 = create_employee(
            self.org,
            {
                "full_name": "Ramesh Kumar",
                "employee_code": "EMP-001",
                "daily_rate": Decimal("800.00"),
                "trade": "MASON",
            },
            self.admin,
        )
        self.emp2 = create_employee(
            self.org,
            {
                "full_name": "Suresh Singh",
                "employee_code": "EMP-002",
                "daily_rate": Decimal("900.00"),
                "trade": "CARPENTER",
            },
            self.admin,
        )

    def test_overview_basic_kpis(self):
        today = timezone.localdate()

        # Mark attendance for today on project 1
        Attendance.objects.create(
            organization=self.org,
            project=self.project1,
            employee=self.emp1,
            date=today,
            status=AttendanceStatus.PRESENT,
            marked_by=self.admin,
        )

        # Set actual spend
        self.project1.actual_spend = Decimal("25000.00")
        self.project1.save()
        self.project2.actual_spend = Decimal("50000.00")
        self.project2.save()

        overview = get_dashboard_overview(self.org, self.admin, force_refresh=True)

        assert overview["active_projects"] == 2
        assert overview["active_workers"] == 2
        assert overview["workers_on_site_today"] == 1
        assert overview["total_budget"] == "300000.00"
        assert overview["total_spend"] == "75000.00"
        # Utilization = 75000 / 300000 * 100 = 25.00%
        assert overview["budget_utilization_percent"] == "25.00"

    def test_month_expenditure_and_daily_burn(self):
        today = timezone.localdate()

        # Approved expense this month
        Expense.objects.create(
            organization=self.org,
            project=self.project1,
            category=ExpenseCategory.MATERIAL,
            description="Cement bags",
            amount=Decimal("12000.00"),
            expense_date=today,
            payment_mode=PaymentMode.CASH,
            status=ExpenseStatus.APPROVED,
            created_by=self.admin,
        )

        # Approved payroll run this month
        PayrollRun.objects.create(
            organization=self.org,
            project=self.project1,
            period_start=today.replace(day=1),
            period_end=today,
            total_gross=Decimal("18000.00"),
            total_net=Decimal("18000.00"),
            status=PayrollRunStatus.APPROVED,
            created_by=self.admin,
        )

        overview = get_dashboard_overview(self.org, self.admin, force_refresh=True)

        # Month expenditure = 12000 + 18000 = 30000.00
        assert overview["month_expenditure"] == "30000.00"
        # Daily burn over 30 days = 30000 / 30 = 1000.00
        assert overview["burn_rate_daily"] == "1000.00"

    def test_cash_and_bank_balances_from_ledger(self):
        today = timezone.localdate()
        # Post journal entry to debit cash and bank
        post_journal_entry(
            org=self.org,
            date=today,
            description="Initial capital",
            lines=[
                {"account_code": "1001", "side": Side.DR, "amount": "50000.00"},
                {"account_code": "1002", "side": Side.DR, "amount": "150000.00"},
                {"account_code": "3001", "side": Side.CR, "amount": "200000.00"},
            ],
            user=self.admin,
        )

        overview = get_dashboard_overview(self.org, self.admin, force_refresh=True)
        assert overview["cash_balance"] == "50000.00"
        assert overview["bank_balance"] == "150000.00"

    def test_pending_approvals_counts(self):
        today = timezone.localdate()

        # Pending expense
        Expense.objects.create(
            organization=self.org,
            project=self.project1,
            category=ExpenseCategory.FUEL,
            description="Diesel",
            amount=Decimal("4000.00"),
            expense_date=today,
            payment_mode=PaymentMode.CASH,
            status=ExpenseStatus.PENDING_APPROVAL,
            created_by=self.admin,
        )

        # Submitted DPR
        DailyProgressReport.objects.create(
            organization=self.org,
            project=self.project1,
            report_date=today,
            summary="Excavation completed",
            status=DPRStatus.SUBMITTED,
            submitted_by=self.admin,
        )

        # Unlocked attendance
        Attendance.objects.create(
            organization=self.org,
            project=self.project1,
            employee=self.emp1,
            date=today,
            status=AttendanceStatus.PRESENT,
            is_locked=False,
            marked_by=self.admin,
        )

        # Draft payroll run
        PayrollRun.objects.create(
            organization=self.org,
            project=self.project1,
            period_start=today,
            period_end=today,
            status=PayrollRunStatus.DRAFT,
            created_by=self.admin,
        )

        overview = get_dashboard_overview(self.org, self.admin, force_refresh=True)
        assert overview["pending_approvals"]["expenses"] == 1
        assert overview["pending_approvals"]["dpr"] == 1
        assert overview["pending_approvals"]["attendance_days_unlocked"] == 1
        assert overview["pending_approvals"]["payroll_runs"] == 1

    def test_alerts_budget_90_and_missing_dpr(self):
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)

        # Trigger BUDGET_90: budget 100,000, spend 92,000 (92%)
        self.project1.actual_spend = Decimal("92000.00")
        self.project1.save()

        # Project 2 has a DPR yesterday, Project 1 does not
        DailyProgressReport.objects.create(
            organization=self.org,
            project=self.project2,
            report_date=yesterday,
            summary="Slab work yesterday",
            status=DPRStatus.VERIFIED,
            submitted_by=self.admin,
        )

        overview = get_dashboard_overview(self.org, self.admin, force_refresh=True)
        alert_types = [a["type"] for a in overview["alerts"]]

        assert "BUDGET_90" in alert_types
        # Project 1 is missing DPR for yesterday
        missing_dpr_alerts = [a for a in overview["alerts"] if a["type"] == "MISSING_DPR"]
        assert len(missing_dpr_alerts) == 1
        assert missing_dpr_alerts[0]["project_id"] == self.project1.id

    def test_alerts_utility_spike_and_unpaid_vendor(self):
        today = timezone.localdate()

        # Utility spike expense
        Expense.objects.create(
            organization=self.org,
            project=self.project1,
            category=ExpenseCategory.UTILITY,
            description="Water bill surge",
            amount=Decimal("15000.00"),
            expense_date=today,
            payment_mode=PaymentMode.BANK_TRANSFER,
            status=ExpenseStatus.APPROVED,
            details={"spike_warning": True},
            created_by=self.admin,
        )

        # Vendor with unpaid credit bill past due date
        vendor = Vendor.objects.create(organization=self.org, name="Ultratech Cement")
        Expense.objects.create(
            organization=self.org,
            project=self.project1,
            vendor=vendor,
            category=ExpenseCategory.MATERIAL,
            description="Credit cement delivery",
            amount=Decimal("35000.00"),
            expense_date=today - timedelta(days=15),
            due_date=today - timedelta(days=2),  # Past due date
            payment_mode=PaymentMode.CREDIT,
            status=ExpenseStatus.APPROVED,
            created_by=self.admin,
        )

        overview = get_dashboard_overview(self.org, self.admin, force_refresh=True)
        alert_types = [a["type"] for a in overview["alerts"]]

        assert "UTILITY_SPIKE" in alert_types
        assert "UNPAID_VENDOR_DUE" in alert_types

    def test_pm_project_scoping_isolation(self):
        # PM is assigned only to Project 1, not Project 2
        overview = get_dashboard_overview(self.org, self.pm, force_refresh=True)

        # Scoped to only 1 active project (Project 1: 100,000 budget)
        assert overview["active_projects"] == 1
        assert overview["total_budget"] == "100000.00"
        assert len(overview["projects"]) == 1
        assert overview["projects"][0]["id"] == self.project1.id

    def test_caching_and_force_refresh(self):
        # Compute and cache
        data1 = get_dashboard_overview(self.org, self.admin, force_refresh=False)
        assert data1["active_projects"] == 2

        # Add another active project
        new_proj = create_project(
            self.org,
            self.admin,
            {"name": "Tower C", "code": "PRJ-C", "estimated_budget": Decimal("50000.00")},
        )
        new_proj.status = ProjectStatus.ACTIVE
        new_proj.save()

        # Without force_refresh, returns cached result
        data2 = get_dashboard_overview(self.org, self.admin, force_refresh=False)
        assert data2["active_projects"] == 2

        # With force_refresh, fetches updated result
        data3 = get_dashboard_overview(self.org, self.admin, force_refresh=True)
        assert data3["active_projects"] == 3

    def test_project_detail_dashboard(self):
        today = timezone.localdate()

        # Add DPR for project 1
        DailyProgressReport.objects.create(
            organization=self.org,
            project=self.project1,
            report_date=today,
            summary="Finishing foundation work",
            status=DPRStatus.VERIFIED,
            submitted_by=self.admin,
        )

        detail = get_project_dashboard(self.project1, self.admin)
        assert detail["project_id"] == self.project1.id
        assert detail["code"] == "PRJ-A"
        assert detail["budget"] == "100000.00"
        assert len(detail["latest_dprs"]) == 1
        assert detail["latest_dprs"][0]["summary"] == "Finishing foundation work"

    def test_multi_tenant_isolation(self):
        # Create Organization Beta
        org_b, _, tok_b = create_organization("Beta Infra", "admin@beta.test")
        admin_b, _ = accept_invitation(tok_b, "BetaPass123#", "Admin Beta")

        p_beta = create_project(
            org_b,
            admin_b,
            {"name": "Beta Site", "code": "BETA-01", "estimated_budget": Decimal("500000.00")},
        )
        p_beta.status = ProjectStatus.ACTIVE
        p_beta.save()

        overview_a = get_dashboard_overview(self.org, self.admin, force_refresh=True)
        overview_b = get_dashboard_overview(org_b, admin_b, force_refresh=True)

        assert overview_a["total_budget"] == "300000.00"
        assert overview_b["total_budget"] == "500000.00"
