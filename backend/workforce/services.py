"""
Workforce business services:
- Employee registration with wage rate validation
- Pay-rate editing permissions and EMPLOYEE_PAY_CHANGED auditing
- Labor group gang creation, membership assignment, and deletion guards
"""

from decimal import Decimal

from django.db import transaction

from audit.constants import AuditAction
from audit.services import log_action
from core.exceptions import BusinessRuleError
from core.money import q2
from core.roles import Role
from core.sequences import next_number
from workforce.models import Employee, EmploymentType, LaborGroup


def create_employee(org, data: dict, user, request=None) -> Employee:
    """
    Register a worker or monthly site staff member.
    Enforces minimum pay rates and role limits (Supervisors cannot set wage rates).
    """
    emp_type = data.get("employment_type", EmploymentType.DAILY_WAGE)
    daily_rate = q2(data.get("daily_rate", Decimal("0.00")))
    monthly_salary = q2(data.get("monthly_salary", Decimal("0.00")))
    ot_rate = q2(data.get("ot_hourly_rate", Decimal("0.00")))

    # Supervisors cannot set pay-rate fields
    if user.role == Role.SUPERVISOR:
        daily_rate = Decimal("0.00")
        monthly_salary = Decimal("0.00")
        ot_rate = Decimal("0.00")
    else:
        # Validate rates based on employment type
        if emp_type == EmploymentType.DAILY_WAGE and daily_rate <= Decimal("0.00"):
            raise BusinessRuleError(
                "Daily-wage workers require daily_rate > 0.", code="daily_rate_required"
            )
        elif emp_type == EmploymentType.MONTHLY_SALARY and monthly_salary <= Decimal("0.00"):
            raise BusinessRuleError(
                "Monthly staff require monthly_salary > 0.", code="monthly_salary_required"
            )

    with transaction.atomic():
        # Auto-generate employee_code if not supplied
        code = data.get("employee_code")
        if not code:
            code = next_number(org, key="EMP", prefix="EMP-", width=4)

        employee = Employee.objects.create(
            organization=org,
            employee_code=code,
            full_name=data["full_name"],
            phone=data.get("phone", ""),
            email=data.get("email", ""),
            role=data.get("role") or data.get("trade") or "Karigar",
            address=data.get("address", ""),
            emergency_contact=data.get("emergency_contact", ""),
            bank_name=data.get("bank_name", ""),
            joining_date=data.get("joining_date"),
            is_active=data.get("is_active", True),
            trade=data.get("trade", "HELPER"),
            skill_level=data.get("skill_level", "UNSKILLED"),
            employment_type=emp_type,
            daily_rate=daily_rate,
            ot_hourly_rate=ot_rate,
            monthly_salary=monthly_salary,
            bank_account_name=data.get("bank_account_name", ""),
            bank_account_number=data.get("bank_account_number", ""),
            bank_ifsc=data.get("bank_ifsc", ""),
            upi_id=data.get("upi_id", ""),
            id_proof_type=data.get("id_proof_type", "AADHAAR"),
            id_proof_number=data.get("id_proof_number", ""),
            primary_project=data.get("primary_project"),
            group=data.get("group"),
        )

        if "assigned_project_ids" in data:
            employee.assigned_projects.set(data["assigned_project_ids"])

        return employee


def update_employee(employee: Employee, data: dict, user, request=None) -> Employee:
    """
    Update employee information.
    Supervisors are forbidden from altering pay rates.
    Any pay rate change by ADM or PM triggers EMPLOYEE_PAY_CHANGED audit log.
    """
    pay_fields = ["daily_rate", "ot_hourly_rate", "monthly_salary"]
    has_pay_update = any(f in data for f in pay_fields)

    if has_pay_update and user.role not in [Role.ORG_ADMIN, Role.PROJECT_MANAGER]:
        raise BusinessRuleError(
            "Only ORG_ADMIN and PROJECT_MANAGER can modify worker pay rates.",
            code="permission_denied",
        )

    old_daily = employee.daily_rate
    old_monthly = employee.monthly_salary
    old_ot = employee.ot_hourly_rate

    with transaction.atomic():
        for field, value in data.items():
            setattr(employee, field, value)

        # Validate rates
        if (
            employee.employment_type == EmploymentType.DAILY_WAGE
            and employee.daily_rate <= Decimal("0.00")
        ):
            # Only enforce if rate was explicitly supplied
            if "daily_rate" in data:
                raise BusinessRuleError(
                    "Daily-wage workers require daily_rate > 0.", code="daily_rate_required"
                )
        elif (
            employee.employment_type == EmploymentType.MONTHLY_SALARY
            and employee.monthly_salary <= Decimal("0.00")
        ):
            if "monthly_salary" in data:
                raise BusinessRuleError(
                    "Monthly staff require monthly_salary > 0.", code="monthly_salary_required"
                )

        employee.save()

        # Audit pay rate alterations
        if has_pay_update and (
            employee.daily_rate != old_daily
            or employee.monthly_salary != old_monthly
            or employee.ot_hourly_rate != old_ot
        ):
            log_action(
                user=user,
                action=AuditAction.EMPLOYEE_PAY_CHANGED,
                obj=employee,
                changes={
                    "daily_rate": {"old": str(old_daily), "new": str(employee.daily_rate)},
                    "monthly_salary": {
                        "old": str(old_monthly),
                        "new": str(employee.monthly_salary),
                    },
                    "ot_hourly_rate": {"old": str(old_ot), "new": str(employee.ot_hourly_rate)},
                },
                request=request,
                organization=employee.organization,
            )

    return employee


def create_labor_group(org, project, name: str, leader=None) -> LaborGroup:
    """Create a labor gang linked to a specific project and optional leader."""
    with transaction.atomic():
        group = LaborGroup.objects.create(
            organization=org,
            project=project,
            name=name,
            leader=leader,
            is_active=True,
        )
        if leader:
            leader.group = group
            leader.save(update_fields=["group"])
    return group


def add_gang_members(group: LaborGroup, employee_ids: list[int]) -> int:
    """Assign workers to this gang (a worker can only belong to one gang at a time)."""
    updated_count = Employee.objects.filter(
        organization=group.organization,
        id__in=employee_ids,
    ).update(group=group)
    return updated_count


def remove_gang_member(group: LaborGroup, employee_id: int):
    """Remove a worker from the gang."""
    with transaction.atomic():
        if group.leader_id == employee_id:
            group.leader = None
            group.save(update_fields=["leader"])
        Employee.objects.filter(id=employee_id, group=group).update(group=None)


def delete_labor_group(group: LaborGroup):
    """Delete a gang only when it has no members."""
    member_count = group.members.filter(deleted_at__isnull=True).count()
    if member_count > 0:
        raise BusinessRuleError(
            "Cannot delete labor group that still has active members.", code="group_not_empty"
        )
    group.delete()


def get_employee_financials(employee: Employee) -> dict:
    """
    Calculate real-time financial telemetry for an employee:
    - total_pagar: Gross earnings from approved payroll vouchers and attendance (or baseline daily rate)
    - total_upad: Total advances/upad taken across both Advance and Payment models
    - total_paid: Total paid wages disbursed
    - balance: Remaining payable balance (e.g. 800 daily rate - 500 upad = 300 balance)
    """
    from django.db.models import Sum

    from attendance.models import Attendance, AttendanceStatus

    # 1. Total Pagar:
    voucher_pagar = employee.payroll_vouchers.filter(deleted_at__isnull=True).aggregate(
        total=Sum("gross_pay")
    )["total"] or Decimal("0.00")

    # Calculate attendance days as baseline
    daily_rate = employee.daily_rate or Decimal("0.00")
    ot_rate = employee.ot_hourly_rate or Decimal("0.00")
    att_qs = Attendance.objects.filter(employee=employee, deleted_at__isnull=True)
    present_days = att_qs.filter(status=AttendanceStatus.PRESENT).count()
    half_days = att_qs.filter(status=AttendanceStatus.HALF_DAY).count()
    holiday_days = att_qs.filter(status=AttendanceStatus.HOLIDAY).count()
    ot_hours = att_qs.aggregate(total_ot=Sum("ot_hours"))["total_ot"] or Decimal("0.00")

    attendance_units = (
        Decimal(str(present_days))
        + Decimal("0.5") * Decimal(str(half_days))
        + Decimal(str(holiday_days))
    )
    attendance_pagar = q2(attendance_units * daily_rate + ot_hours * ot_rate)

    total_pagar = max(voucher_pagar, attendance_pagar)

    # 2. Total Upad (Advances):
    adv_sum = employee.advances.filter(deleted_at__isnull=True).aggregate(total=Sum("amount"))[
        "total"
    ] or Decimal("0.00")
    # Sum Upad Payments avoiding double-counting with synced Advance records
    upad_pay_qs = employee.upad_payments.filter(
        type__in=["advance", "withdrawal"],
        status__in=["paid", "confirmed", "approved"],
        deleted_at__isnull=True,
    )
    unlinked_upad = Decimal("0.00")
    for p in upad_pay_qs:
        if p.description and p.description.startswith("[ADV-"):
            continue
        if employee.advances.filter(reason__contains=f"[UPAD-{p.id}]").exists():
            continue
        unlinked_upad += p.amount
    total_upad = q2(adv_sum + unlinked_upad)

    # 3. Total Paid:
    vouch_paid = employee.payroll_vouchers.filter(status="PAID", deleted_at__isnull=True).aggregate(
        total=Sum("net_pay")
    )["total"] or Decimal("0.00")
    upad_sal_sum = employee.upad_payments.filter(
        type="salary",
        status__in=["paid", "confirmed"],
        deleted_at__isnull=True,
    ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    total_paid = q2(vouch_paid + upad_sal_sum)

    # 4. Remaining Balance: e.g. 800 wage - 500 upad = 300 balance
    balance = max(Decimal("0.00"), q2(total_pagar - total_upad - total_paid))

    return {
        "total_pagar": str(q2(total_pagar)),
        "total_upad": str(q2(total_upad)),
        "total_paid": str(q2(total_paid)),
        "balance": str(q2(balance)),
        "has_attendance": bool(present_days > 0 or half_days > 0 or holiday_days > 0),
        "attendance_days": float(attendance_units),
    }


def assign_project_to_employee(employee: Employee, project_id: int) -> Employee:
    """Assign an active project to the employee."""
    from projects.models import Project

    project = Project.objects.get(id=project_id, organization=employee.organization)
    employee.assigned_projects.add(project)
    if not employee.primary_project:
        employee.primary_project = project
        employee.save(update_fields=["primary_project"])
    return employee


def unassign_project_from_employee(employee: Employee, project_id: int) -> Employee:
    """Remove project assignment from the employee."""
    from projects.models import Project

    project = Project.objects.get(id=project_id, organization=employee.organization)
    employee.assigned_projects.remove(project)
    if employee.primary_project_id == project_id:
        employee.primary_project = employee.assigned_projects.first()
        employee.save(update_fields=["primary_project"])
    return employee


def record_employee_payment(
    employee: Employee,
    amount: Decimal,
    payment_mode: str = "CASH",
    notes: str = "",
    user=None,
    request=None,
):
    """Disburse payment to employee, creating a PAID voucher."""
    from django.utils import timezone

    from attendance.models import Attendance, AttendanceStatus
    from core.exceptions import BusinessRuleError
    from core.sequences import next_number
    from payroll.models import PayrollRun, PayrollRunStatus, PayrollVoucher, VoucherStatus
    from projects.models import Project

    has_attendance = Attendance.objects.filter(
        employee=employee,
        status__in=[AttendanceStatus.PRESENT, AttendanceStatus.HALF_DAY, AttendanceStatus.HOLIDAY],
        deleted_at__isnull=True,
    ).exists()
    if not has_attendance:
        raise BusinessRuleError(
            "Cannot pay wages to a newly added employee without marked attendance. Attendance must be marked first.",
            code="attendance_required",
        )

    proj = employee.primary_project or employee.assigned_projects.first()
    if not proj:
        proj = Project.objects.filter(organization=employee.organization).first()

    today = timezone.now().date()
    run = PayrollRun.objects.filter(
        organization=employee.organization,
        project=proj,
        period_start__lte=today,
        period_end__gte=today,
    ).first()

    if not run:
        run = PayrollRun.objects.create(
            organization=employee.organization,
            project=proj,
            period_start=today.replace(day=1),
            period_end=today,
            status=PayrollRunStatus.APPROVED,
            created_by=user or employee.organization.users.first(),
            approved_by=user,
            approved_at=timezone.now(),
        )

    from django.db.models import Sum

    from attendance.models import Attendance, AttendanceStatus

    att_qs = Attendance.objects.filter(
        employee=employee,
        date__gte=run.period_start,
        date__lte=run.period_end,
    )
    p_count = att_qs.filter(status=AttendanceStatus.PRESENT).count()
    h_count = att_qs.filter(status=AttendanceStatus.HALF_DAY).count()
    ot_sum = att_qs.aggregate(total=Sum("ot_hours"))["total"] or Decimal("0.00")

    v_num = next_number(employee.organization, key="VOUCH", prefix="VOU-", width=5)
    voucher = PayrollVoucher.objects.create(
        organization=employee.organization,
        run=run,
        employee=employee,
        voucher_number=v_num,
        days_present=p_count,
        half_days=h_count,
        ot_hours=ot_sum,
        daily_rate_used=employee.daily_rate,
        basic_pay=amount,
        gross_pay=amount,
        net_pay=amount,
        payment_mode=payment_mode,
        status=VoucherStatus.PAID,
        paid_at=timezone.now(),
        payment_reference=notes,
    )
    return voucher


def record_employee_upad(
    employee: Employee,
    amount: Decimal,
    advance_date=None,
    reason: str = "",
    payment_mode: str = "CASH",
    user=None,
    request=None,
):
    """Record advance / upad given to employee and sync with UPAD Payment module."""
    from django.utils import timezone

    from payroll.models import Advance, AdvanceStatus, Payment, PaymentLifecycleStatus, PaymentType
    from projects.models import Project

    proj = employee.primary_project or employee.assigned_projects.first()
    if not proj:
        proj = Project.objects.filter(organization=employee.organization).first()

    date_val = advance_date or timezone.now().date()
    adv = Advance.objects.create(
        organization=employee.organization,
        employee=employee,
        project=proj,
        amount=amount,
        advance_date=date_val,
        reason=reason,
        payment_mode=payment_mode,
        given_by=user or employee.organization.users.first(),
        status=AdvanceStatus.OPEN,
    )

    # Sync into UPAD Payment module
    try:
        Payment.objects.create(
            organization=employee.organization,
            employee=employee,
            project=proj,
            type=PaymentType.ADVANCE,
            base_salary=employee.daily_rate or Decimal("0.00"),
            amount=amount,
            method=payment_mode.lower(),
            status=PaymentLifecycleStatus.PAID,
            date_from=date_val,
            date_to=date_val,
            description=f"[ADV-{adv.id}] {reason}".strip(),
            created_by=user or employee.organization.users.first(),
            processed_by=user or employee.organization.users.first(),
            processed_at=timezone.now(),
        )
    except Exception:
        pass

    try:
        from ledger.services_transactions import TransactionService

        TransactionService.sync_organization_transactions(employee.organization)
    except Exception:
        pass

    return adv


def get_employee_payment_history(employee: Employee) -> list:
    """Return chronological ledger of all advances (upad) and payments."""
    history = []

    for v in employee.payroll_vouchers.filter(status="PAID").order_by("-paid_at", "-id"):
        history.append(
            {
                "id": f"pay-{v.id}",
                "type": "PAYMENT",
                "title": f"Wage Payment ({v.voucher_number})",
                "amount": str(v.net_pay),
                "date": (v.paid_at.date() if v.paid_at else v.created_at.date()).isoformat(),
                "mode": v.payment_mode,
                "status": "PAID",
                "notes": v.payment_reference or "Direct wage payout",
            }
        )

    for a in employee.advances.all().order_by("-advance_date", "-id"):
        history.append(
            {
                "id": f"upad-{a.id}",
                "type": "UPAD",
                "title": "Advance / Upad Given",
                "amount": str(a.amount),
                "date": a.advance_date.isoformat(),
                "mode": a.payment_mode,
                "status": a.status,
                "notes": a.reason or "Worker advance",
            }
        )

    for p in employee.upad_payments.filter(deleted_at__isnull=True).order_by("-created_at", "-id"):
        # Avoid showing duplicate if already listed via Advance
        if p.description and p.description.startswith("[ADV-"):
            continue
        if employee.advances.filter(reason__contains=f"[UPAD-{p.id}]").exists():
            continue
        p_date = p.date_from or (p.created_at.date() if p.created_at else None)
        history.append(
            {
                "id": f"upad-pay-{p.id}",
                "type": "UPAD" if p.type in ["advance", "withdrawal"] else "PAYMENT",
                "title": f"Upad {p.type.title()} ({p.method.upper()})",
                "amount": str(p.amount),
                "date": p_date.isoformat() if p_date else "",
                "mode": p.method.upper(),
                "status": p.status.upper(),
                "notes": p.description or f"Upad {p.type}",
            }
        )

    history.sort(key=lambda x: x["date"], reverse=True)
    return history
