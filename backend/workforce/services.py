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
