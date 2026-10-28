"""
Management command to seed complete realistic demonstration data for Phase P8.
Seeds Alpha Constructions (main demo tenant) and Beta Builders (multi-tenant isolation).
Usage:
python manage.py seed_all
python manage.py seed_all --clean
"""

import os
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import Organization, User
from attendance.models import (
    Attendance,
    AttendanceStatus,
    Holiday,
    HolidayType,
)
from core.roles import Role
from expenses.models import (
    Expense,
    ExpenseCategory,
    ExpenseStatus,
    PaymentMode,
    RunningCostBaseline,
    UtilityType,
    Vendor,
    VendorPayment,
)
from ledger.models import ReferenceType, Side
from ledger.services import create_default_chart_of_accounts, post_journal_entry, trial_balance
from payroll.models import (
    Advance,
    AdvanceStatus,
    PayrollRun,
    PayrollRunStatus,
    PayrollVoucher,
    VoucherStatus,
)
from progress.models import DailyProgressReport, DPRStatus, MaterialUsage, TaskProgress
from projects.models import BudgetCategory, Project, ProjectMembership, ProjectStatus
from workforce.models import Employee, EmploymentType, LaborGroup, Trade


class Command(BaseCommand):
    help = "Seeds database with comprehensive demo data for Alpha Constructions and Beta Builders (Phase P8)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Delete existing Alpha Constructions and Beta Builders before seeding.",
        )

    def handle(self, *args, **options):
        clean = options.get("clean", False)
        password = os.environ.get("SEED_PASSWORD", "Pass1234#")

        self.stdout.write(
            self.style.MIGRATE_HEADING("=== Starting CMP Database Seeding (Phase P8) ===")
        )

        def _clean_org(org_name):
            try:
                org = Organization.objects.get(name=org_name)
            except Organization.DoesNotExist:
                return

            from django.db import connection

            tables = [
                "audit_auditlog",
                "ledger_journalline",
                "ledger_journalentry",
                "payroll_payrollvoucher",
                "payroll_payrollrun",
                "payroll_advance",
                "expenses_vendorpayment",
                "expenses_expense",
                "expenses_runningcostbaseline",
                "expenses_vendor",
                "progress_sitephoto",
                "progress_materialusage",
                "progress_taskprogress",
                "progress_dailyprogressreport",
                "attendance_attendance",
                "attendance_holiday",
                "workforce_employee",
                "workforce_laborgroup",
                "projects_budgetcategory",
                "projects_projectmembership",
                "projects_project",
                "ledger_account",
                "accounts_invitation",
                "accounts_passwordresettoken",
                "accounts_user",
                "accounts_organization",
            ]
            with connection.cursor() as cursor:
                try:
                    cursor.execute("SET session_replication_role = 'replica';")
                except Exception:
                    pass
                try:
                    cursor.execute(
                        "DELETE FROM accounts_passwordresettoken WHERE user_id IN (SELECT id FROM accounts_user WHERE organization_id = %s)",
                        [org.id],
                    )
                    for tbl in tables:
                        if tbl == "accounts_passwordresettoken":
                            continue
                        col = "id" if tbl == "accounts_organization" else "organization_id"
                        cursor.execute(f"DELETE FROM {tbl} WHERE {col} = %s", [org.id])
                finally:
                    try:
                        cursor.execute("SET session_replication_role = 'origin';")
                    except Exception:
                        pass

        if clean:
            self.stdout.write("Cleaning previous seed tenants...")
            _clean_org("Alpha Constructions")
            _clean_org("Beta Builders")

        today = timezone.localdate()

        # ======================================================================
        # 1. TENANT 1: ALPHA CONSTRUCTIONS
        # ======================================================================
        self.stdout.write(self.style.MIGRATE_LABEL("\n1. Seeding Tenant: Alpha Constructions"))

        org_alpha, created = Organization.objects.get_or_create(
            name="Alpha Constructions",
            defaults={
                "contact_email": "admin@alpha.test",
                "contact_phone": "+91 98200 12345",
                "address": "401 Marathon Max, Mulund West, Mumbai, Maharashtra 400080",
                "currency": "INR",
                "workday_hours": Decimal("8.00"),
                "half_day_hours": Decimal("4.00"),
                "overtime_after_hours": Decimal("8.00"),
                "expense_approval_limit": Decimal("10000.00"),
            },
        )
        create_default_chart_of_accounts(org_alpha)

        # Users for Alpha
        def _get_or_create_user(org, email, role, full_name, phone=""):
            email = email.lower().strip()
            user, u_created = User.objects.get_or_create(
                email=email,
                defaults={
                    "organization": org,
                    "role": role,
                    "name": full_name,
                    "phone": phone,
                    "is_active": True,
                },
            )
            user.set_password(password)
            user.save()
            return user

        alpha_admin = _get_or_create_user(
            org_alpha, "admin@alpha.test", Role.ORG_ADMIN, "Aarav Mehta", "+91 98200 00001"
        )
        alpha_pm = _get_or_create_user(
            org_alpha, "pm@alpha.test", Role.PROJECT_MANAGER, "Priya Sharma", "+91 98200 00002"
        )
        alpha_eng = _get_or_create_user(
            org_alpha, "eng@alpha.test", Role.SITE_ENGINEER, "Rohan Gupta", "+91 98200 00003"
        )
        alpha_sup1 = _get_or_create_user(
            org_alpha, "sup1@alpha.test", Role.SUPERVISOR, "Sanjay Patil", "+91 98200 00004"
        )
        alpha_sup2 = _get_or_create_user(
            org_alpha, "sup2@alpha.test", Role.SUPERVISOR, "Vikram Shinde", "+91 98200 00005"
        )
        alpha_acc = _get_or_create_user(
            org_alpha, "acc@alpha.test", Role.ACCOUNTANT, "Ananya Desai", "+91 98200 00006"
        )

        self.stdout.write(f"  ✓ 6 Alpha users created with password '{password}'")

        # Capital injection and Client billing
        entry_cap_date = today - timedelta(days=20)
        post_journal_entry(
            org=org_alpha,
            date=entry_cap_date,
            description="Initial Owner Capital Contribution",
            lines=[
                {"account_code": "1002", "side": Side.DR, "amount": "10000000.00"},
                {"account_code": "3001", "side": Side.CR, "amount": "10000000.00"},
            ],
            reference_type=ReferenceType.MANUAL,
            user=alpha_admin,
        )

        post_journal_entry(
            org=org_alpha,
            date=today - timedelta(days=15),
            description="Milestone 1 Billing: Skyline Tower Client",
            lines=[
                {"account_code": "1200", "side": Side.DR, "amount": "5000000.00"},
                {"account_code": "4001", "side": Side.CR, "amount": "5000000.00"},
            ],
            reference_type=ReferenceType.MANUAL,
            user=alpha_admin,
        )

        post_journal_entry(
            org=org_alpha,
            date=today - timedelta(days=10),
            description="Client Payment Received for Milestone 1",
            lines=[
                {"account_code": "1002", "side": Side.DR, "amount": "3000000.00"},
                {"account_code": "1200", "side": Side.CR, "amount": "3000000.00"},
            ],
            reference_type=ReferenceType.MANUAL,
            user=alpha_admin,
        )

        # Cash replenishment for advances / site petty cash
        post_journal_entry(
            org=org_alpha,
            date=today - timedelta(days=15),
            description="Cash withdrawal for Site Operations",
            lines=[
                {"account_code": "1001", "side": Side.DR, "amount": "500000.00"},
                {"account_code": "1002", "side": Side.CR, "amount": "500000.00"},
            ],
            reference_type=ReferenceType.MANUAL,
            user=alpha_admin,
        )
        self.stdout.write("  ✓ Capital and banking opening journals posted")

        # Projects for Alpha
        def _get_or_create_project(org, code, name, budget, status):
            proj, _ = Project.objects.get_or_create(
                organization=org,
                code=code,
                defaults={
                    "name": name,
                    "estimated_budget": budget,
                    "actual_spend": Decimal("0.00"),
                    "status": status,
                    "start_date": today - timedelta(days=30),
                    "expected_end_date": today + timedelta(days=335),
                },
            )
            for cat in ["LABOR", "MATERIALS", "EQUIPMENT", "OVERHEAD"]:
                BudgetCategory.objects.get_or_create(
                    organization=org,
                    project=proj,
                    name=cat,
                    defaults={"allocated_amount": budget / 4},
                )
            return proj

        proj_sky = _get_or_create_project(
            org_alpha,
            "PRJ-SKY",
            "Skyline Tower",
            Decimal("50000000.00"),
            ProjectStatus.ACTIVE,
        )
        proj_riv = _get_or_create_project(
            org_alpha,
            "PRJ-RIV",
            "Riverside Mall",
            Decimal("30000000.00"),
            ProjectStatus.ACTIVE,
        )

        # Assign project memberships
        for u, role_name in [
            (alpha_pm, "Site PM"),
            (alpha_eng, "Site Engineer"),
            (alpha_sup1, "Supervisor"),
        ]:
            ProjectMembership.objects.get_or_create(
                organization=org_alpha, project=proj_sky, user=u, defaults={"site_role": role_name}
            )

        for u, role_name in [(alpha_pm, "Site PM"), (alpha_sup2, "Supervisor")]:
            ProjectMembership.objects.get_or_create(
                organization=org_alpha, project=proj_riv, user=u, defaults={"site_role": role_name}
            )

        self.stdout.write(
            "  ✓ Projects 'Skyline Tower' and 'Riverside Mall' initialized with geofences"
        )

        # Running Cost Baselines
        RunningCostBaseline.objects.get_or_create(
            organization=org_alpha,
            project=proj_sky,
            utility_type=UtilityType.ELECTRICITY,
            defaults={"monthly_baseline": Decimal("10000.00")},
        )
        RunningCostBaseline.objects.get_or_create(
            organization=org_alpha,
            project=proj_sky,
            utility_type=UtilityType.WATER,
            defaults={"monthly_baseline": Decimal("5000.00")},
        )

        # Workforce for Alpha: 1 Staff + 19 Workers = 20
        workers_data = [
            (
                "Manoj Joshi",
                "EMP-001",
                Trade.OTHER,
                Decimal("0.00"),
                Decimal("45000.00"),
                EmploymentType.MONTHLY_SALARY,
            ),
            (
                "Ramesh Kumar",
                "EMP-002",
                Trade.MASON,
                Decimal("800.00"),
                Decimal("0.00"),
                EmploymentType.DAILY_WAGE,
            ),
            (
                "Suresh Singh",
                "EMP-003",
                Trade.CARPENTER,
                Decimal("850.00"),
                Decimal("0.00"),
                EmploymentType.DAILY_WAGE,
            ),
            (
                "Dinesh Verma",
                "EMP-004",
                Trade.HELPER,
                Decimal("800.00"),
                Decimal("0.00"),
                EmploymentType.DAILY_WAGE,
            ),
            (
                "Mukesh Yadav",
                "EMP-005",
                Trade.ELECTRICIAN,
                Decimal("900.00"),
                Decimal("0.00"),
                EmploymentType.DAILY_WAGE,
            ),
            (
                "Rajesh Patel",
                "EMP-006",
                Trade.WELDER,
                Decimal("950.00"),
                Decimal("0.00"),
                EmploymentType.DAILY_WAGE,
            ),
            (
                "Ganesh Nair",
                "EMP-007",
                Trade.PLUMBER,
                Decimal("850.00"),
                Decimal("0.00"),
                EmploymentType.DAILY_WAGE,
            ),
            (
                "Santosh Shinde",
                "EMP-008",
                Trade.HELPER,
                Decimal("650.00"),
                Decimal("0.00"),
                EmploymentType.DAILY_WAGE,
            ),
            (
                "Prakash Pawar",
                "EMP-009",
                Trade.HELPER,
                Decimal("650.00"),
                Decimal("0.00"),
                EmploymentType.DAILY_WAGE,
            ),
            (
                "Mahesh Kamble",
                "EMP-010",
                Trade.MASON,
                Decimal("800.00"),
                Decimal("0.00"),
                EmploymentType.DAILY_WAGE,
            ),
            (
                "Sunil Gaikwad",
                "EMP-011",
                Trade.CARPENTER,
                Decimal("850.00"),
                Decimal("0.00"),
                EmploymentType.DAILY_WAGE,
            ),
            (
                "Anil Jadhav",
                "EMP-012",
                Trade.HELPER,
                Decimal("800.00"),
                Decimal("0.00"),
                EmploymentType.DAILY_WAGE,
            ),
            (
                "Vijay Salve",
                "EMP-013",
                Trade.ELECTRICIAN,
                Decimal("900.00"),
                Decimal("0.00"),
                EmploymentType.DAILY_WAGE,
            ),
            (
                "Ajay Bhosale",
                "EMP-014",
                Trade.WELDER,
                Decimal("950.00"),
                Decimal("0.00"),
                EmploymentType.DAILY_WAGE,
            ),
            (
                "Deepak More",
                "EMP-015",
                Trade.PLUMBER,
                Decimal("850.00"),
                Decimal("0.00"),
                EmploymentType.DAILY_WAGE,
            ),
            (
                "Sachin Kadam",
                "EMP-016",
                Trade.HELPER,
                Decimal("650.00"),
                Decimal("0.00"),
                EmploymentType.DAILY_WAGE,
            ),
            (
                "Nitin Chavan",
                "EMP-017",
                Trade.HELPER,
                Decimal("650.00"),
                Decimal("0.00"),
                EmploymentType.DAILY_WAGE,
            ),
            (
                "Rahul Thorat",
                "EMP-018",
                Trade.MASON,
                Decimal("800.00"),
                Decimal("0.00"),
                EmploymentType.DAILY_WAGE,
            ),
            (
                "Amit Mane",
                "EMP-019",
                Trade.CARPENTER,
                Decimal("850.00"),
                Decimal("0.00"),
                EmploymentType.DAILY_WAGE,
            ),
            (
                "Kishore Sawant",
                "EMP-020",
                Trade.HELPER,
                Decimal("800.00"),
                Decimal("0.00"),
                EmploymentType.DAILY_WAGE,
            ),
        ]

        alpha_employees = []
        for name, code, trade, rate, salary, emp_type in workers_data:
            emp, _ = Employee.objects.get_or_create(
                organization=org_alpha,
                employee_code=code,
                defaults={
                    "full_name": name,
                    "trade": trade,
                    "daily_rate": rate,
                    "monthly_salary": salary,
                    "employment_type": emp_type,
                    "phone": f"+91 99000 {code[-3:]}00",
                    "bank_account_number": f"100200300{code[-3:]}",
                    "bank_ifsc": "SBIN0001234",
                    "bank_account_name": name,
                    "upi_id": f"{code.lower()}@okhdfcbank",
                    "primary_project": proj_sky if int(code[-3:]) <= 14 else proj_riv,
                    "is_active": True,
                },
            )
            alpha_employees.append(emp)

        self.stdout.write(f"  ✓ {len(alpha_employees)} workers and staff registered")

        # 3 Gangs for Alpha
        gang_civ, _ = LaborGroup.objects.get_or_create(
            organization=org_alpha,
            name="Civil Works Gang",
            defaults={"project": proj_sky, "leader": alpha_employees[1]},
        )
        gang_stl, _ = LaborGroup.objects.get_or_create(
            organization=org_alpha,
            name="Steel & Rebar Gang",
            defaults={"project": proj_sky, "leader": alpha_employees[3]},
        )
        gang_mep, _ = LaborGroup.objects.get_or_create(
            organization=org_alpha,
            name="MEP & Electrical Gang",
            defaults={"project": proj_riv, "leader": alpha_employees[4]},
        )

        for emp in alpha_employees[1:7]:  # EMP 2 to 7
            emp.group = gang_civ
            emp.save(update_fields=["group"])
        for emp in alpha_employees[7:14]:  # EMP 8 to 14
            emp.group = gang_stl
            emp.save(update_fields=["group"])
        for emp in alpha_employees[14:]:  # EMP 15 to 20
            emp.group = gang_mep
            emp.save(update_fields=["group"])

        self.stdout.write("  ✓ 3 Labor gangs formed and assigned")

        # Holiday
        Holiday.objects.get_or_create(
            organization=org_alpha,
            date=today - timedelta(days=9),
            defaults={
                "name": "State Formation Day",
                "holiday_type": HolidayType.NATIONAL,
                "is_paid": True,
            },
        )

        # 14 Days Attendance History
        self.stdout.write("  ✓ Seeding 14 days of attendance history...")
        for day_offset in range(13, -1, -1):
            att_date = today - timedelta(days=day_offset)
            is_first_week = day_offset >= 7  # First 7 days are locked

            for idx, emp in enumerate(alpha_employees):
                proj = proj_sky if idx < 14 else proj_riv
                # Distribute status: mostly PRESENT, some HALF_DAY, some ABSENT
                if (idx + day_offset) % 17 == 0:
                    status = AttendanceStatus.ABSENT
                    ot = Decimal("0.00")
                elif (idx + day_offset) % 11 == 0:
                    status = AttendanceStatus.HALF_DAY
                    ot = Decimal("0.00")
                else:
                    status = AttendanceStatus.PRESENT
                    ot = Decimal("2.00") if (idx + day_offset) % 4 == 0 else Decimal("0.00")

                Attendance.objects.get_or_create(
                    organization=org_alpha,
                    employee=emp,
                    date=att_date,
                    defaults={
                        "project": proj,
                        "status": status,
                        "ot_hours": ot,
                        "marked_by": alpha_sup1 if proj == proj_sky else alpha_sup2,
                        "is_locked": is_first_week,
                        "locked_at": timezone.now() - timedelta(days=6) if is_first_week else None,
                        "locked_by": alpha_pm if is_first_week else None,
                    },
                )

        # 5 DPRs (3 Verified, 1 Submitted, 1 Rejected)
        dpr1, _ = DailyProgressReport.objects.get_or_create(
            organization=org_alpha,
            project=proj_sky,
            report_date=today - timedelta(days=4),
            defaults={
                "summary": "Completed foundation raft reinforcement and formwork inspections.",
                "weather": "Clear 31C",
                "status": DPRStatus.VERIFIED,
                "submitted_by": alpha_sup1,
                "verified_by": alpha_pm,
                "verified_at": timezone.now() - timedelta(days=3),
            },
        )
        TaskProgress.objects.get_or_create(
            organization=org_alpha,
            report=dpr1,
            task_name="Raft Formwork",
            defaults={"percent_complete": Decimal("100.00")},
        )
        MaterialUsage.objects.get_or_create(
            organization=org_alpha,
            report=dpr1,
            material_name="Plywood Sheets",
            defaults={"quantity": Decimal("40.000"), "unit": "sheets"},
        )

        dpr2, _ = DailyProgressReport.objects.get_or_create(
            organization=org_alpha,
            project=proj_sky,
            report_date=today - timedelta(days=3),
            defaults={
                "summary": "Poured 120 cum M35 grade ready-mix concrete for main column piers.",
                "weather": "Sunny 33C",
                "status": DPRStatus.VERIFIED,
                "submitted_by": alpha_sup1,
                "verified_by": alpha_pm,
                "verified_at": timezone.now() - timedelta(days=2),
            },
        )
        TaskProgress.objects.get_or_create(
            organization=org_alpha,
            report=dpr2,
            task_name="Pier Concreting",
            defaults={"percent_complete": Decimal("85.00")},
        )
        MaterialUsage.objects.get_or_create(
            organization=org_alpha,
            report=dpr2,
            material_name="RMC M35",
            defaults={"quantity": Decimal("120.000"), "unit": "cum"},
        )

        dpr3, _ = DailyProgressReport.objects.get_or_create(
            organization=org_alpha,
            project=proj_riv,
            report_date=today - timedelta(days=2),
            defaults={
                "summary": "Site leveling, earthwork excavation, and boundary drainage trenches completed.",
                "weather": "Dry 29C",
                "status": DPRStatus.VERIFIED,
                "submitted_by": alpha_sup2,
                "verified_by": alpha_pm,
                "verified_at": timezone.now() - timedelta(days=1),
            },
        )
        TaskProgress.objects.get_or_create(
            organization=org_alpha,
            report=dpr3,
            task_name="Earth Excavation",
            defaults={"percent_complete": Decimal("100.00")},
        )
        MaterialUsage.objects.get_or_create(
            organization=org_alpha,
            report=dpr3,
            material_name="Diesel",
            defaults={"quantity": Decimal("250.000"), "unit": "litres"},
        )

        dpr4, _ = DailyProgressReport.objects.get_or_create(
            organization=org_alpha,
            project=proj_sky,
            report_date=today - timedelta(days=1),
            defaults={
                "summary": "Basement slab rebar tying underway. Awaiting structural sign-off.",
                "weather": "Partly Cloudy 30C",
                "status": DPRStatus.SUBMITTED,
                "submitted_by": alpha_sup1,
            },
        )
        TaskProgress.objects.get_or_create(
            organization=org_alpha,
            report=dpr4,
            task_name="Basement Rebar",
            defaults={"percent_complete": Decimal("65.00")},
        )

        dpr5, _ = DailyProgressReport.objects.get_or_create(
            organization=org_alpha,
            project=proj_riv,
            report_date=today - timedelta(days=1),
            defaults={
                "summary": "Subsoil compaction stopped due to unseasonal rain shower.",
                "weather": "Rainy 26C",
                "status": DPRStatus.REJECTED,
                "submitted_by": alpha_sup2,
                "rejection_reason": "No photo attachments provided and compaction dry density readings omitted.",
            },
        )
        self.stdout.write("  ✓ 5 DPRs created (3 verified, 1 submitted, 1 rejected)")

        # 3 Vendors
        v_cement, _ = Vendor.objects.get_or_create(
            organization=org_alpha,
            name="Ultratech Cement Ltd",
            defaults={
                "contact_person": "Rajesh Shah",
                "phone": "+91 98210 11111",
                "email": "sales@ultratech.test",
                "address": "Ahura Centre, Andheri East, Mumbai",
            },
        )
        v_steel, _ = Vendor.objects.get_or_create(
            organization=org_alpha,
            name="Tata Steel Supply Corp",
            defaults={
                "contact_person": "Deepak Verma",
                "phone": "+91 98210 22222",
                "email": "commercial@tatasteel.test",
                "address": "Fort, Mumbai",
            },
        )
        v_fuel, _ = Vendor.objects.get_or_create(
            organization=org_alpha,
            name="Mahindra Fuel & Logistics",
            defaults={
                "contact_person": "Sunil Patil",
                "phone": "+91 98210 33333",
                "email": "orders@mahindrafuel.test",
                "address": "MIDC Turbhe, Navi Mumbai",
            },
        )

        # 15 Expenses
        # 1 & 2: Pending approvals (> 10,000 limit created by ENG)
        Expense.objects.get_or_create(
            organization=org_alpha,
            description="Emergency drainage pump set purchase",
            defaults={
                "project": proj_sky,
                "category": ExpenseCategory.EQUIPMENT_RENTAL,
                "amount": Decimal("18500.00"),
                "expense_date": today,
                "payment_mode": PaymentMode.CASH,
                "status": ExpenseStatus.PENDING_APPROVAL,
                "created_by": alpha_eng,
            },
        )
        Expense.objects.get_or_create(
            organization=org_alpha,
            description="Steel scaffolding clamps bulk lot",
            defaults={
                "project": proj_riv,
                "category": ExpenseCategory.MATERIAL,
                "amount": Decimal("24000.00"),
                "expense_date": today,
                "payment_mode": PaymentMode.CASH,
                "status": ExpenseStatus.PENDING_APPROVAL,
                "created_by": alpha_eng,
            },
        )

        # 3: Credit purchase (past due date -> triggers UNPAID_VENDOR_DUE alert)
        exp_cred1, _ = Expense.objects.get_or_create(
            organization=org_alpha,
            description="TMT 500D 16mm rebar delivery (Credit Invoice #TS-409)",
            defaults={
                "project": proj_sky,
                "vendor": v_steel,
                "category": ExpenseCategory.MATERIAL,
                "amount": Decimal("65000.00"),
                "expense_date": today - timedelta(days=20),
                "due_date": today - timedelta(days=3),  # Past due!
                "payment_mode": PaymentMode.CREDIT,
                "status": ExpenseStatus.APPROVED,
                "created_by": alpha_eng,
                "approved_by": alpha_pm,
                "approved_at": timezone.now() - timedelta(days=20),
            },
        )
        if not exp_cred1.journal_entry:
            j_cred1 = post_journal_entry(
                org=org_alpha,
                date=exp_cred1.expense_date,
                description=f"Credit Purchase: {exp_cred1.description}",
                lines=[
                    {"account_code": "5001", "side": Side.DR, "amount": exp_cred1.amount},
                    {"account_code": "2001", "side": Side.CR, "amount": exp_cred1.amount},
                ],
                reference_type=ReferenceType.EXPENSE,
                reference_id=exp_cred1.id,
                user=alpha_pm,
                project=proj_sky,
            )
            exp_cred1.journal_entry = j_cred1
            exp_cred1.save()
            proj_sky.actual_spend += exp_cred1.amount
            proj_sky.save()

        # 4: Credit purchase (within due date)
        exp_cred2, _ = Expense.objects.get_or_create(
            organization=org_alpha,
            description="PPC Cement 400 bags (Credit Invoice #UT-880)",
            defaults={
                "project": proj_sky,
                "vendor": v_cement,
                "category": ExpenseCategory.MATERIAL,
                "amount": Decimal("40000.00"),
                "expense_date": today - timedelta(days=10),
                "due_date": today + timedelta(days=20),
                "payment_mode": PaymentMode.CREDIT,
                "status": ExpenseStatus.APPROVED,
                "created_by": alpha_eng,
                "approved_by": alpha_pm,
                "approved_at": timezone.now() - timedelta(days=10),
            },
        )
        if not exp_cred2.journal_entry:
            j_cred2 = post_journal_entry(
                org=org_alpha,
                date=exp_cred2.expense_date,
                description=f"Credit Purchase: {exp_cred2.description}",
                lines=[
                    {"account_code": "5001", "side": Side.DR, "amount": exp_cred2.amount},
                    {"account_code": "2001", "side": Side.CR, "amount": exp_cred2.amount},
                ],
                reference_type=ReferenceType.EXPENSE,
                reference_id=exp_cred2.id,
                user=alpha_pm,
                project=proj_sky,
            )
            exp_cred2.journal_entry = j_cred2
            exp_cred2.save()
            proj_sky.actual_spend += exp_cred2.amount
            proj_sky.save()

        # 5: Vendor Repayment (Repaying 20,000 of Ultratech Cement credit bill)
        vp, _ = VendorPayment.objects.get_or_create(
            organization=org_alpha,
            vendor=v_cement,
            reference="NEFT-UT-PAY-01",
            defaults={
                "project": proj_sky,
                "amount": Decimal("20000.00"),
                "payment_date": today - timedelta(days=5),
                "payment_mode": PaymentMode.BANK_TRANSFER,
                "notes": "Part-payment for invoice #UT-880",
                "paid_by": alpha_acc,
            },
        )
        if not vp.journal_entry:
            j_vp = post_journal_entry(
                org=org_alpha,
                date=vp.payment_date,
                description=f"Vendor Payment to {v_cement.name}",
                lines=[
                    {"account_code": "2001", "side": Side.DR, "amount": vp.amount},
                    {"account_code": "1002", "side": Side.CR, "amount": vp.amount},
                ],
                reference_type=ReferenceType.VENDOR_PAYMENT,
                reference_id=vp.id,
                user=alpha_acc,
                project=proj_sky,
            )
            vp.journal_entry = j_vp
            vp.save()

        # 6: Utility Spike (Baseline 10,000, Amount 14,500 -> triggers UTILITY_SPIKE)
        exp_spike, _ = Expense.objects.get_or_create(
            organization=org_alpha,
            description="Site electrical substation tariff spike bill",
            defaults={
                "project": proj_sky,
                "category": ExpenseCategory.UTILITY,
                "amount": Decimal("14500.00"),
                "expense_date": today - timedelta(days=2),
                "payment_mode": PaymentMode.BANK_TRANSFER,
                "status": ExpenseStatus.APPROVED,
                "details": {"spike_warning": True, "utility_type": UtilityType.ELECTRICITY},
                "created_by": alpha_eng,
                "approved_by": alpha_pm,
                "approved_at": timezone.now() - timedelta(days=2),
            },
        )
        if not exp_spike.journal_entry:
            j_spike = post_journal_entry(
                org=org_alpha,
                date=exp_spike.expense_date,
                description=f"Utility Expense: {exp_spike.description}",
                lines=[
                    {"account_code": "5004", "side": Side.DR, "amount": exp_spike.amount},
                    {"account_code": "1002", "side": Side.CR, "amount": exp_spike.amount},
                ],
                reference_type=ReferenceType.EXPENSE,
                reference_id=exp_spike.id,
                user=alpha_pm,
                project=proj_sky,
            )
            exp_spike.journal_entry = j_spike
            exp_spike.save()
            proj_sky.actual_spend += exp_spike.amount
            proj_sky.save()

        # 7-15: Other standard approved expenses (fuel, machinery, petty cash)
        other_expenses_seed = [
            (
                proj_sky,
                ExpenseCategory.FUEL,
                Decimal("12500.00"),
                "Tower crane diesel refill",
                PaymentMode.CASH,
                "5003",
                "1001",
                v_fuel,
            ),
            (
                proj_sky,
                ExpenseCategory.TRANSPORT,
                Decimal("18000.00"),
                "Hydraulic piling rig mobilization transport",
                PaymentMode.BANK_TRANSFER,
                "5003",
                "1002",
                None,
            ),
            (
                proj_sky,
                ExpenseCategory.EQUIPMENT_RENTAL,
                Decimal("35000.00"),
                "Transit mixer monthly rental charge",
                PaymentMode.BANK_TRANSFER,
                "5002",
                "1002",
                None,
            ),
            (
                proj_sky,
                ExpenseCategory.PETTY_CASH,
                Decimal("4500.00"),
                "Safety helmets, high-vis vests and gloves",
                PaymentMode.CASH,
                "5006",
                "1001",
                None,
            ),
            (
                proj_riv,
                ExpenseCategory.FUEL,
                Decimal("9800.00"),
                "JCB excavator diesel replenishment",
                PaymentMode.CASH,
                "5003",
                "1001",
                v_fuel,
            ),
            (
                proj_riv,
                ExpenseCategory.MATERIAL,
                Decimal("22000.00"),
                "Crushed stone aggregate 20mm 4 brass",
                PaymentMode.BANK_TRANSFER,
                "5001",
                "1002",
                None,
            ),
            (
                proj_riv,
                ExpenseCategory.EQUIPMENT_RENTAL,
                Decimal("15000.00"),
                "Vibratory road roller rental",
                PaymentMode.BANK_TRANSFER,
                "5002",
                "1002",
                None,
            ),
            (
                proj_riv,
                ExpenseCategory.UTILITY,
                Decimal("4200.00"),
                "Borewell water tanker delivery",
                PaymentMode.CASH,
                "5004",
                "1001",
                None,
            ),
            (
                proj_riv,
                ExpenseCategory.PETTY_CASH,
                Decimal("3200.00"),
                "Site office stationery, printing and tea",
                PaymentMode.CASH,
                "5006",
                "1001",
                None,
            ),
        ]

        for p, cat, amt, desc, mode, acct_dr, acct_cr, v_obj in other_expenses_seed:
            exp_obj, _ = Expense.objects.get_or_create(
                organization=org_alpha,
                description=desc,
                defaults={
                    "project": p,
                    "vendor": v_obj,
                    "category": cat,
                    "amount": amt,
                    "expense_date": today - timedelta(days=6),
                    "payment_mode": mode,
                    "status": ExpenseStatus.APPROVED,
                    "created_by": alpha_eng,
                    "approved_by": alpha_pm,
                    "approved_at": timezone.now() - timedelta(days=5),
                },
            )
            if not exp_obj.journal_entry:
                j_obj = post_journal_entry(
                    org=org_alpha,
                    date=exp_obj.expense_date,
                    description=f"Expense: {desc}",
                    lines=[
                        {"account_code": acct_dr, "side": Side.DR, "amount": amt},
                        {"account_code": acct_cr, "side": Side.CR, "amount": amt},
                    ],
                    reference_type=ReferenceType.EXPENSE,
                    reference_id=exp_obj.id,
                    user=alpha_pm,
                    project=p,
                )
                exp_obj.journal_entry = j_obj
                exp_obj.save()
                p.actual_spend += amt
                p.save()

        self.stdout.write(
            "  ✓ 15 Expenses seeded (including credit purchases, baseline spikes, and repayments)"
        )

        # Payroll: 3 Advances
        def _create_advance(emp, proj, amt, reason):
            adv, _ = Advance.objects.get_or_create(
                organization=org_alpha,
                employee=emp,
                advance_date=today - timedelta(days=12),
                defaults={
                    "project": proj,
                    "amount": amt,
                    "adjusted_amount": Decimal("0.00"),
                    "status": AdvanceStatus.OPEN,
                    "reason": reason,
                    "payment_mode": "CASH",
                    "given_by": alpha_pm,
                },
            )
            if not adv.journal_entry:
                j_adv = post_journal_entry(
                    org=org_alpha,
                    date=adv.advance_date,
                    description=f"Worker Advance to {emp.full_name}",
                    lines=[
                        {"account_code": "1100", "side": Side.DR, "amount": amt},
                        {"account_code": "1001", "side": Side.CR, "amount": amt},
                    ],
                    reference_type=ReferenceType.ADVANCE,
                    reference_id=adv.id,
                    user=alpha_pm,
                    project=proj,
                )
                adv.journal_entry = j_adv
                adv.save()
            return adv

        adv1 = _create_advance(
            alpha_employees[1], proj_sky, Decimal("2000.00"), "Family emergency medical expense"
        )
        adv2 = _create_advance(
            alpha_employees[2], proj_sky, Decimal("1500.00"), "Travel expenses for home visit"
        )
        _create_advance(
            alpha_employees[3], proj_sky, Decimal("1000.00"), "Festival festival grocery advance"
        )

        # Week 1 Approved Payroll Run for Skyline Tower
        pr_week1, _ = PayrollRun.objects.get_or_create(
            organization=org_alpha,
            project=proj_sky,
            period_start=today - timedelta(days=14),
            period_end=today - timedelta(days=8),
            defaults={
                "status": PayrollRunStatus.APPROVED,
                "created_by": alpha_acc,
                "approved_by": alpha_admin,
                "approved_at": timezone.now() - timedelta(days=7),
            },
        )

        # Generate vouchers for week 1
        vouchers_w1 = []
        tot_gross_w1 = Decimal("0.00")
        tot_adv_w1 = Decimal("0.00")
        tot_net_w1 = Decimal("0.00")

        for idx, emp in enumerate(alpha_employees[:14]):  # Workers assigned to Skyline
            v_num = f"VCH-W1-{emp.employee_code[-3:]}"
            basic = (
                (emp.daily_rate * 6)
                if emp.employment_type == EmploymentType.DAILY_WAGE
                else Decimal("10500.00")
            )
            ot = Decimal("600.00") if idx in [2, 4, 6] else Decimal("0.00")
            gross = basic + ot

            # Deduct advance if applicable
            adv_deduct = Decimal("0.00")
            if emp == alpha_employees[1] and adv1.status == AdvanceStatus.OPEN:
                adv_deduct = min(adv1.remaining_amount, Decimal("2000.00"))
                adv1.adjusted_amount += adv_deduct
                adv1.status = AdvanceStatus.ADJUSTED
                adv1.save()
            elif emp == alpha_employees[2] and adv2.status == AdvanceStatus.OPEN:
                adv_deduct = min(adv2.remaining_amount, Decimal("1500.00"))
                adv2.adjusted_amount += adv_deduct
                adv2.status = AdvanceStatus.ADJUSTED
                adv2.save()

            net = gross - adv_deduct
            tot_gross_w1 += gross
            tot_adv_w1 += adv_deduct
            tot_net_w1 += net

            is_paid = idx < 8  # Mark first 8 paid
            v_obj, _ = PayrollVoucher.objects.get_or_create(
                organization=org_alpha,
                run=pr_week1,
                employee=emp,
                defaults={
                    "voucher_number": v_num,
                    "days_present": 6,
                    "half_days": 0,
                    "ot_hours": Decimal("4.00") if ot > 0 else Decimal("0.00"),
                    "daily_rate_used": emp.daily_rate,
                    "basic_pay": basic,
                    "ot_pay": ot,
                    "gross_pay": gross,
                    "advances_deducted": adv_deduct,
                    "net_pay": net,
                    "status": VoucherStatus.PAID if is_paid else VoucherStatus.PENDING,
                    "paid_at": timezone.now() - timedelta(days=6) if is_paid else None,
                },
            )
            vouchers_w1.append(v_obj)

        pr_week1.total_gross = tot_gross_w1
        pr_week1.total_advances = tot_adv_w1
        pr_week1.total_net = tot_net_w1

        # Post payroll approval journal
        if not pr_week1.journal_entry:
            j_pr1 = post_journal_entry(
                org=org_alpha,
                date=pr_week1.period_end,
                description=f"Payroll Week 1 Approval: {proj_sky.name}",
                lines=[
                    {"account_code": "5005", "side": Side.DR, "amount": tot_gross_w1},
                    {"account_code": "1100", "side": Side.CR, "amount": tot_adv_w1},
                    {"account_code": "1002", "side": Side.CR, "amount": tot_net_w1},
                ],
                reference_type=ReferenceType.PAYROLL,
                reference_id=pr_week1.id,
                user=alpha_admin,
                project=proj_sky,
            )
            pr_week1.journal_entry = j_pr1
            proj_sky.actual_spend += tot_gross_w1
            proj_sky.save()

        pr_week1.save()

        # Week 2 Draft Payroll Run
        pr_week2, _ = PayrollRun.objects.get_or_create(
            organization=org_alpha,
            project=proj_sky,
            period_start=today - timedelta(days=7),
            period_end=today - timedelta(days=1),
            defaults={
                "status": PayrollRunStatus.DRAFT,
                "created_by": alpha_acc,
            },
        )
        self.stdout.write("  ✓ Payroll runs seeded: Week 1 (Approved & posted), Week 2 (Draft)")

        # Verify Alpha Trial Balance
        tb_alpha = trial_balance(org_alpha)
        assert tb_alpha["is_balanced"], f"Alpha Trial Balance is not balanced! {tb_alpha}"
        self.stdout.write(
            self.style.SUCCESS(
                f"  ✓ Alpha Trial Balance verified: Total DR={tb_alpha['total_debit']} == CR={tb_alpha['total_credit']}"
            )
        )

        # ======================================================================
        # 2. TENANT 2: BETA BUILDERS (Multi-Tenant Isolation)
        # ======================================================================
        self.stdout.write(self.style.MIGRATE_LABEL("\n2. Seeding Tenant: Beta Builders"))

        org_beta, created_b = Organization.objects.get_or_create(
            name="Beta Builders",
            defaults={
                "contact_email": "admin@beta.test",
                "contact_phone": "+91 80 2200 9999",
                "currency": "INR",
            },
        )
        create_default_chart_of_accounts(org_beta)

        beta_admin = _get_or_create_user(org_beta, "admin@beta.test", Role.ORG_ADMIN, "Bharat Sen")
        beta_pm = _get_or_create_user(
            org_beta, "pm@beta.test", Role.PROJECT_MANAGER, "Bhavna Patel"
        )

        # Capital injection for Beta
        post_journal_entry(
            org=org_beta,
            date=today - timedelta(days=20),
            description="Beta Opening Capital",
            lines=[
                {"account_code": "1002", "side": Side.DR, "amount": "5000000.00"},
                {"account_code": "3001", "side": Side.CR, "amount": "5000000.00"},
            ],
            reference_type=ReferenceType.MANUAL,
            user=beta_admin,
        )

        proj_beta = _get_or_create_project(
            org_beta,
            "PRJ-BET",
            "Beta Heights",
            Decimal("25000000.00"),
            ProjectStatus.ACTIVE,
        )
        ProjectMembership.objects.get_or_create(
            organization=org_beta,
            project=proj_beta,
            user=beta_pm,
            defaults={"site_role": "Site PM"},
        )

        emp_b1, _ = Employee.objects.get_or_create(
            organization=org_beta,
            employee_code="BETA-01",
            defaults={
                "full_name": "Anil Yadav",
                "trade": Trade.MASON,
                "daily_rate": Decimal("850.00"),
                "is_active": True,
            },
        )
        emp_b2, _ = Employee.objects.get_or_create(
            organization=org_beta,
            employee_code="BETA-02",
            defaults={
                "full_name": "Sunil Shrestha",
                "trade": Trade.HELPER,
                "daily_rate": Decimal("700.00"),
                "is_active": True,
            },
        )

        # 3 Attendance records for Beta
        for emp, day_b in [(emp_b1, 1), (emp_b2, 1), (emp_b1, 2)]:
            Attendance.objects.get_or_create(
                organization=org_beta,
                employee=emp,
                date=today - timedelta(days=day_b),
                defaults={
                    "project": proj_beta,
                    "status": AttendanceStatus.PRESENT,
                    "marked_by": beta_pm,
                    "is_locked": True,
                },
            )

        # 2 Expenses for Beta
        exp_b1, _ = Expense.objects.get_or_create(
            organization=org_beta,
            description="Beta initial sand and gravel",
            defaults={
                "project": proj_beta,
                "category": ExpenseCategory.MATERIAL,
                "amount": Decimal("15000.00"),
                "expense_date": today - timedelta(days=5),
                "payment_mode": PaymentMode.BANK_TRANSFER,
                "status": ExpenseStatus.APPROVED,
                "created_by": beta_pm,
                "approved_by": beta_admin,
            },
        )
        if not exp_b1.journal_entry:
            j_b1 = post_journal_entry(
                org=org_beta,
                date=exp_b1.expense_date,
                description=exp_b1.description,
                lines=[
                    {"account_code": "5001", "side": Side.DR, "amount": exp_b1.amount},
                    {"account_code": "1002", "side": Side.CR, "amount": exp_b1.amount},
                ],
                reference_type=ReferenceType.EXPENSE,
                reference_id=exp_b1.id,
                user=beta_admin,
                project=proj_beta,
            )
            exp_b1.journal_entry = j_b1
            exp_b1.save()
            proj_beta.actual_spend += exp_b1.amount
            proj_beta.save()

        Expense.objects.get_or_create(
            organization=org_beta,
            description="Beta hydraulic breaker hire (pending)",
            defaults={
                "project": proj_beta,
                "category": ExpenseCategory.EQUIPMENT_RENTAL,
                "amount": Decimal("28000.00"),
                "expense_date": today,
                "payment_mode": PaymentMode.BANK_TRANSFER,
                "status": ExpenseStatus.PENDING_APPROVAL,
                "created_by": beta_pm,
            },
        )

        tb_beta = trial_balance(org_beta)
        assert tb_beta["is_balanced"], f"Beta Trial Balance is not balanced! {tb_beta}"
        self.stdout.write(
            self.style.SUCCESS(
                f"  ✓ Beta Trial Balance verified: Total DR={tb_beta['total_debit']} == CR={tb_beta['total_credit']}"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                "\n=== All Demonstration and Isolation Data Seeded Successfully! ==="
            )
        )
