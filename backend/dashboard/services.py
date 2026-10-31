"""
Dashboard analytics services.
Provides aggregated executive KPIs and project-level drill-down summaries.
Layer 7: Read-only consumer of projects, workforce, attendance, progress, expenses, payroll, ledger.
"""

from datetime import timedelta
from decimal import Decimal

from attendance.models import Attendance, AttendanceStatus
from core.money import q2
from core.roles import Role
from django.core.cache import cache
from django.db.models import Sum
from django.utils import timezone
from expenses.models import Expense, ExpenseCategory, ExpenseStatus, PaymentMode
from ledger.models import JournalLine, Side
from payroll.models import PayrollRun, PayrollRunStatus
from progress.models import DailyProgressReport, DPRStatus
from projects.models import Project, ProjectStatus
from projects.services import user_project_ids
from rest_framework.exceptions import PermissionDenied
from workforce.models import Employee


def get_dashboard_overview(org, user, force_refresh: bool = False) -> dict:
    """
    Generate organization-wide or role-scoped executive dashboard metrics.
    Caches results per organization and role/user for 60 seconds.
    """
    # 1. Check cache unless explicit refresh requested
    if user.role == Role.ORG_ADMIN:
        cache_key = f"dashboard_overview_{org.id}_{user.role}"
    else:
        cache_key = f"dashboard_overview_{org.id}_{user.role}_{user.id}"

    if not force_refresh:
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return cached_data

    # 2. Determine project scope
    if user.role == Role.ORG_ADMIN:
        scoped_projects = Project.objects.filter(organization=org, deleted_at__isnull=True)
    else:
        allowed_ids = user_project_ids(user)
        scoped_projects = Project.objects.filter(
            organization=org, id__in=allowed_ids, deleted_at__isnull=True
        )

    active_projects = scoped_projects.filter(status=ProjectStatus.ACTIVE)
    active_projects_count = active_projects.count()

    # 3. Active workers count in tenant
    active_workers_count = Employee.objects.filter(
        organization=org, is_active=True, deleted_at__isnull=True
    ).count()

    # 4. Workers on site today
    today = timezone.localdate()
    workers_on_site_today = (
        Attendance.objects.filter(
            organization=org,
            project__in=active_projects,
            date=today,
            status__in=[AttendanceStatus.PRESENT, AttendanceStatus.HALF_DAY],
            deleted_at__isnull=True,
        )
        .values("employee_id")
        .distinct()
        .count()
    )

    # 5. Total Budget and Actual Spend
    tot_budget = active_projects.aggregate(total=Sum("estimated_budget"))["total"] or Decimal(
        "0.00"
    )
    tot_spend = active_projects.aggregate(total=Sum("actual_spend"))["total"] or Decimal("0.00")

    if tot_budget > Decimal("0.00"):
        budget_utilization_percent = q2((tot_spend / tot_budget) * Decimal("100.00"))
    else:
        budget_utilization_percent = Decimal("0.00")

    # 6. Month Expenditure (Current month approved expenses + approved payroll gross)
    start_of_month = today.replace(day=1)
    month_expenses = Expense.objects.filter(
        organization=org,
        project__in=active_projects,
        status=ExpenseStatus.APPROVED,
        expense_date__gte=start_of_month,
        expense_date__lte=today,
        deleted_at__isnull=True,
    ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

    month_payroll = PayrollRun.objects.filter(
        organization=org,
        project__in=active_projects,
        status__in=[PayrollRunStatus.APPROVED, PayrollRunStatus.PAID],
        period_end__gte=start_of_month,
        period_end__lte=today,
        deleted_at__isnull=True,
    ).aggregate(total=Sum("total_gross"))["total"] or Decimal("0.00")
    month_expenditure = q2(month_expenses + month_payroll)

    # 7. Daily Burn Rate over last 30 days
    thirty_days_ago = today - timedelta(days=30)
    expenses_last_30 = Expense.objects.filter(
        organization=org,
        project__in=active_projects,
        status=ExpenseStatus.APPROVED,
        expense_date__gte=thirty_days_ago,
        expense_date__lte=today,
        deleted_at__isnull=True,
    ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    payroll_last_30 = PayrollRun.objects.filter(
        organization=org,
        project__in=active_projects,
        status__in=[PayrollRunStatus.APPROVED, PayrollRunStatus.PAID],
        period_end__gte=thirty_days_ago,
        period_end__lte=today,
        deleted_at__isnull=True,
    ).aggregate(total=Sum("total_gross"))["total"] or Decimal("0.00")
    burn_rate_daily = q2((expenses_last_30 + payroll_last_30) / Decimal("30.00"))

    # 8. Cash & Bank Balances from Ledger (Accounts 1001 and 1002)
    def _account_balance(code: str) -> str:
        lines = JournalLine.objects.filter(organization=org, account__code=code)
        dr = lines.filter(side=Side.DR).aggregate(t=Sum("amount"))["t"] or Decimal("0.00")
        cr = lines.filter(side=Side.CR).aggregate(t=Sum("amount"))["t"] or Decimal("0.00")
        return str(q2(dr - cr))

    cash_balance = _account_balance("1001")
    bank_balance = _account_balance("1002")

    # 9. Pending Approvals
    pending_approvals = {
        "expenses": Expense.objects.filter(
            organization=org,
            project__in=active_projects,
            status=ExpenseStatus.PENDING_APPROVAL,
            deleted_at__isnull=True,
        ).count(),
        "dpr": DailyProgressReport.objects.filter(
            organization=org,
            project__in=active_projects,
            status=DPRStatus.SUBMITTED,
            deleted_at__isnull=True,
        ).count(),
        "attendance_days_unlocked": Attendance.objects.filter(
            organization=org,
            project__in=active_projects,
            is_locked=False,
            deleted_at__isnull=True,
        )
        .values("project", "date")
        .distinct()
        .count(),
        "payroll_runs": PayrollRun.objects.filter(
            organization=org,
            project__in=active_projects,
            status=PayrollRunStatus.DRAFT,
            deleted_at__isnull=True,
        ).count(),
    }

    # 10. Spend by Category
    # LABOR = approved payroll gross; MATERIALS = MATERIAL; EQUIPMENT = EQUIPMENT_RENTAL;
    # OVERHEAD = FUEL, TRANSPORT, UTILITY, PETTY_CASH, OTHER
    labor_spend = PayrollRun.objects.filter(
        organization=org,
        project__in=active_projects,
        status__in=[PayrollRunStatus.APPROVED, PayrollRunStatus.PAID],
        deleted_at__isnull=True,
    ).aggregate(total=Sum("total_gross"))["total"] or Decimal("0.00")

    exp_cats = dict(
        Expense.objects.filter(
            organization=org,
            project__in=active_projects,
            status=ExpenseStatus.APPROVED,
            deleted_at__isnull=True,
        )
        .values("category")
        .annotate(total=Sum("amount"))
        .values_list("category", "total")
    )

    materials_spend = exp_cats.get(ExpenseCategory.MATERIAL, Decimal("0.00"))
    equipment_spend = exp_cats.get(ExpenseCategory.EQUIPMENT_RENTAL, Decimal("0.00"))
    overhead_spend = (
        exp_cats.get(ExpenseCategory.FUEL, Decimal("0.00"))
        + exp_cats.get(ExpenseCategory.TRANSPORT, Decimal("0.00"))
        + exp_cats.get(ExpenseCategory.UTILITY, Decimal("0.00"))
        + exp_cats.get(ExpenseCategory.PETTY_CASH, Decimal("0.00"))
        + exp_cats.get(ExpenseCategory.OTHER, Decimal("0.00"))
    )

    spend_by_category = [
        {"category": "LABOR", "amount": str(q2(labor_spend))},
        {"category": "MATERIALS", "amount": str(q2(materials_spend))},
        {"category": "EQUIPMENT", "amount": str(q2(equipment_spend))},
        {"category": "OVERHEAD", "amount": str(q2(overhead_spend))},
    ]

    # 11. Attendance Trend (Last 7 days)
    attendance_trend = []
    for days_back in range(6, -1, -1):
        day_date = today - timedelta(days=days_back)
        day_records = Attendance.objects.filter(
            organization=org,
            project__in=active_projects,
            date=day_date,
            deleted_at__isnull=True,
        )
        present_cnt = day_records.filter(status=AttendanceStatus.PRESENT).count()
        half_day_cnt = day_records.filter(status=AttendanceStatus.HALF_DAY).count()
        absent_cnt = day_records.filter(status=AttendanceStatus.ABSENT).count()
        attendance_trend.append(
            {
                "date": str(day_date),
                "present": present_cnt,
                "half_day": half_day_cnt,
                "absent": absent_cnt,
            }
        )

    # 12. Alerts Generation
    # BUDGET_90, MISSING_DPR, UTILITY_SPIKE, UNPAID_VENDOR_DUE
    alerts = []

    # Alert: BUDGET_90
    for proj in active_projects:
        if proj.estimated_budget > Decimal("0.00"):
            ratio = proj.actual_spend / proj.estimated_budget
            if ratio >= Decimal("0.90"):
                pct = round(ratio * Decimal("100"), 1)
                alerts.append(
                    {
                        "type": "BUDGET_90",
                        "project_id": proj.id,
                        "project_name": proj.name,
                        "message": f"Project '{proj.name}' budget utilization reached {pct}%.",
                    }
                )

    # Alert: MISSING_DPR (active project with no DPR for yesterday)
    yesterday = today - timedelta(days=1)
    projects_with_dpr_yesterday = set(
        DailyProgressReport.objects.filter(
            organization=org,
            project__in=active_projects,
            report_date=yesterday,
            deleted_at__isnull=True,
        ).values_list("project_id", flat=True)
    )
    for proj in active_projects:
        if proj.id not in projects_with_dpr_yesterday:
            alerts.append(
                {
                    "type": "MISSING_DPR",
                    "project_id": proj.id,
                    "project_name": proj.name,
                    "message": f"Project '{proj.name}' has no DPR submitted for yesterday ({yesterday}).",
                }
            )

    # Alert: UTILITY_SPIKE
    utility_spiked_expenses = Expense.objects.filter(
        organization=org,
        project__in=active_projects,
        category=ExpenseCategory.UTILITY,
        expense_date__gte=start_of_month,
        deleted_at__isnull=True,
    ).select_related("project")
    for exp in utility_spiked_expenses:
        details = exp.details or {}
        if isinstance(details, dict) and details.get("spike_warning"):
            alerts.append(
                {
                    "type": "UTILITY_SPIKE",
                    "project_id": exp.project_id,
                    "expense_id": exp.id,
                    "message": f"Utility baseline spike detected on project '{exp.project.name}' (Amount: {exp.amount}).",
                }
            )

    # Alert: UNPAID_VENDOR_DUE (credit expense past due_date and vendor outstanding balance > 0)
    overdue_vendor_expenses = (
        Expense.objects.filter(
            organization=org,
            project__in=active_projects,
            payment_mode=PaymentMode.CREDIT,
            status=ExpenseStatus.APPROVED,
            due_date__lt=today,
            vendor__isnull=False,
            deleted_at__isnull=True,
        )
        .select_related("vendor", "project")
        .order_by("due_date")
    )
    seen_vendor_ids = set()
    for exp in overdue_vendor_expenses:
        if exp.vendor_id not in seen_vendor_ids:
            if exp.vendor.outstanding_balance > Decimal("0.00"):
                seen_vendor_ids.add(exp.vendor_id)
                alerts.append(
                    {
                        "type": "UNPAID_VENDOR_DUE",
                        "project_id": exp.project_id,
                        "vendor_id": exp.vendor_id,
                        "vendor_name": exp.vendor.name,
                        "message": f"Unpaid vendor bill to '{exp.vendor.name}' is past due date ({exp.due_date}).",
                    }
                )

    # Calculate net salary payable across active workforce
    from workforce.services import get_employee_financials
    active_emps = Employee.objects.filter(
        organization=org, is_active=True, deleted_at__isnull=True
    )
    if user.role != Role.ORG_ADMIN:
        active_emps = active_emps.filter(
            Q(primary_project__in=active_projects) |
            Q(assigned_projects__in=active_projects)
        ).distinct()

    total_net_salary_payable = Decimal("0.00")
    for emp in active_emps:
        try:
            fin = get_employee_financials(emp)
            total_net_salary_payable += Decimal(str(fin.get("balance", "0.00")))
        except Exception:
            pass

    # 13. Projects Summary
    projects_list = []
    for proj in active_projects:
        if proj.estimated_budget > Decimal("0.00"):
            u_pct = q2((proj.actual_spend / proj.estimated_budget) * Decimal("100.00"))
        else:
            u_pct = Decimal("0.00")

        if proj.estimated_budget > Decimal("0.00") and proj.actual_spend > proj.estimated_budget:
            b_status = "EXCEEDED"
        elif proj.estimated_budget > Decimal("0.00") and proj.actual_spend >= (
            proj.estimated_budget * Decimal("0.90")
        ):
            b_status = "WARNING"
        else:
            b_status = "OK"

        projects_list.append(
            {
                "id": proj.id,
                "name": proj.name,
                "code": proj.code,
                "progress_percent": str(proj.progress_percent),
                "utilization_percent": str(u_pct),
                "budget_status": b_status,
                "estimated_budget": str(proj.estimated_budget),
                "actual_spend": str(proj.actual_spend),
            }
        )

    response_data = {
        "active_projects": active_projects_count,
        "active_workers": active_workers_count,
        "workers_on_site_today": workers_on_site_today,
        "month_expenditure": str(q2(total_net_salary_payable)),
        "employee_amount": str(q2(total_net_salary_payable)),
        "net_salary_payable": str(q2(total_net_salary_payable)),
        "total_budget": str(q2(tot_budget)),
        "total_spend": str(q2(tot_spend)),
        "budget_utilization_percent": str(budget_utilization_percent),
        "burn_rate_daily": str(burn_rate_daily),
        "cash_balance": cash_balance,
        "bank_balance": bank_balance,
        "pending_approvals": pending_approvals,
        "spend_by_category": spend_by_category,
        "attendance_trend": attendance_trend,
        "alerts": alerts,
        "projects": projects_list,
    }

    # Cache for 60 seconds
    cache.set(cache_key, response_data, timeout=60)
    return response_data


def get_project_dashboard(project: Project, user) -> dict:
    """
    Generate project drill-down analytics for project managers and accountants.
    """
    # Permission scoping check
    if user.role != Role.ORG_ADMIN:
        allowed_ids = user_project_ids(user)
        if project.id not in allowed_ids:
            raise PermissionDenied("You are not assigned to this project.")

    today = timezone.localdate()

    # 1. Budget utilization
    if project.estimated_budget > Decimal("0.00"):
        u_pct = q2((project.actual_spend / project.estimated_budget) * Decimal("100.00"))
    else:
        u_pct = Decimal("0.00")

    if (
        project.estimated_budget > Decimal("0.00")
        and project.actual_spend > project.estimated_budget
    ):
        b_status = "EXCEEDED"
    elif project.estimated_budget > Decimal("0.00") and project.actual_spend >= (
        project.estimated_budget * Decimal("0.90")
    ):
        b_status = "WARNING"
    else:
        b_status = "OK"

    # 2. Spend by category for this project
    labor_spend = PayrollRun.objects.filter(
        project=project,
        status__in=[PayrollRunStatus.APPROVED, PayrollRunStatus.PAID],
        deleted_at__isnull=True,
    ).aggregate(total=Sum("total_gross"))["total"] or Decimal("0.00")

    exp_cats = dict(
        Expense.objects.filter(
            project=project,
            status=ExpenseStatus.APPROVED,
            deleted_at__isnull=True,
        )
        .values("category")
        .annotate(total=Sum("amount"))
        .values_list("category", "total")
    )

    materials_spend = exp_cats.get(ExpenseCategory.MATERIAL, Decimal("0.00"))
    equipment_spend = exp_cats.get(ExpenseCategory.EQUIPMENT_RENTAL, Decimal("0.00"))
    overhead_spend = (
        exp_cats.get(ExpenseCategory.FUEL, Decimal("0.00"))
        + exp_cats.get(ExpenseCategory.TRANSPORT, Decimal("0.00"))
        + exp_cats.get(ExpenseCategory.UTILITY, Decimal("0.00"))
        + exp_cats.get(ExpenseCategory.PETTY_CASH, Decimal("0.00"))
        + exp_cats.get(ExpenseCategory.OTHER, Decimal("0.00"))
    )

    spend_by_category = [
        {"category": "LABOR", "amount": str(q2(labor_spend))},
        {"category": "MATERIALS", "amount": str(q2(materials_spend))},
        {"category": "EQUIPMENT", "amount": str(q2(equipment_spend))},
        {"category": "OVERHEAD", "amount": str(q2(overhead_spend))},
    ]

    detailed_categories = [
        {"category": choice[0], "amount": str(q2(exp_cats.get(choice[0], Decimal("0.00"))))}
        for choice in ExpenseCategory.choices
    ]

    # 3. Attendance Trend (Last 7 days)
    attendance_trend = []
    for days_back in range(6, -1, -1):
        day_date = today - timedelta(days=days_back)
        day_records = Attendance.objects.filter(
            project=project,
            date=day_date,
            deleted_at__isnull=True,
        )
        present_cnt = day_records.filter(status=AttendanceStatus.PRESENT).count()
        half_day_cnt = day_records.filter(status=AttendanceStatus.HALF_DAY).count()
        absent_cnt = day_records.filter(status=AttendanceStatus.ABSENT).count()
        attendance_trend.append(
            {
                "date": str(day_date),
                "present": present_cnt,
                "half_day": half_day_cnt,
                "absent": absent_cnt,
            }
        )

    # 4. Latest 5 DPRs
    latest_dprs_qs = (
        DailyProgressReport.objects.filter(project=project, deleted_at__isnull=True)
        .select_related("verified_by", "submitted_by")
        .order_by("-report_date")[:5]
    )

    latest_dprs = [
        {
            "id": d.id,
            "report_date": str(d.report_date),
            "status": d.status,
            "weather": d.weather,
            "summary": d.summary,
            "verified_by": (
                (d.verified_by.full_name or d.verified_by.email) if d.verified_by else None
            ),
        }
        for d in latest_dprs_qs
    ]

    # 5. Pending approvals on this project
    pending_items = {
        "pending_expenses": Expense.objects.filter(
            project=project,
            status=ExpenseStatus.PENDING_APPROVAL,
            deleted_at__isnull=True,
        ).count(),
        "pending_dprs": DailyProgressReport.objects.filter(
            project=project,
            status=DPRStatus.SUBMITTED,
            deleted_at__isnull=True,
        ).count(),
        "unlocked_attendance": Attendance.objects.filter(
            project=project,
            is_locked=False,
            deleted_at__isnull=True,
        )
        .values("date")
        .distinct()
        .count(),
    }

    return {
        "project_id": project.id,
        "name": project.name,
        "code": project.code,
        "status": project.status,
        "budget": str(project.estimated_budget),
        "actual_spend": str(project.actual_spend),
        "progress_percent": str(project.progress_percent),
        "utilization_percent": str(u_pct),
        "budget_status": b_status,
        "spend_by_category": spend_by_category,
        "detailed_expense_categories": detailed_categories,
        "attendance_trend": attendance_trend,
        "latest_dprs": latest_dprs,
        "pending_items": pending_items,
    }
