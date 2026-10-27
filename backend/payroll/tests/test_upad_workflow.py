"""
Automated Test Suite for UPAD Payments, Credits Module, and FIFO Deductions.
Validates all requirements from Construction Project Management - Module Architecture & Workflow Specification.
"""

from decimal import Decimal
import pytest
from django.utils import timezone
from accounts.models import User
from attendance.models import Attendance, AttendanceStatus
from core.exceptions import BusinessRuleError
from core.roles import Role
from expenses.models import CreditLog, CreditLogStatus, RunningCost
from expenses.services_credits import CreditLogsService
from expenses.services_running_costs import RunningCostService
from payroll.models import Payment, PaymentType, PaymentMethod, PaymentLifecycleStatus
from payroll.services_upad import UpadPaymentService
from ledger.models import Transaction, TransactionType, TransactionCategory
from ledger.services_transactions import TransactionService
from workforce.models import Employee
from projects.models import Project


@pytest.fixture
def test_setup(db):
    from accounts.models import Organization
    org = Organization.objects.create(name="Apex Builders")

    admin1 = User.objects.create_user(
        email="admin1@apex.test", password="Password#123", organization=org, role=Role.ORG_ADMIN
    )
    admin2 = User.objects.create_user(
        email="admin2@apex.test", password="Password#123", organization=org, role=Role.ORG_ADMIN
    )

    project = Project.objects.create(
        organization=org, name="Skyline Tower", code="SKY-01", location="Mumbai"
    )

    employee = Employee.objects.create(
        organization=org, full_name="Ramesh Kumar", employee_code="EMP-101",
        daily_rate=Decimal("600.00"), phone="9876543210"
    )

    return {
        "org": org,
        "admin1": admin1,
        "admin2": admin2,
        "project": project,
        "employee": employee,
    }


def test_credit_log_fifo_deduction(test_setup):
    """Section 4.5: Validates FIFO deduction across multiple active credit logs."""
    org = test_setup["org"]
    admin = test_setup["admin1"]

    # Create 2 credit logs: Log1 (₹1000), Log2 (₹2000)
    log1 = CreditLog.objects.create(
        organization=org, credited_by=admin, amount=Decimal("1000.00"),
        description="Cash advance 1", transaction_date=timezone.now().date(),
        remaining_balance=Decimal("1000.00"), status=CreditLogStatus.ACTIVE
    )
    log2 = CreditLog.objects.create(
        organization=org, credited_by=admin, amount=Decimal("2000.00"),
        description="Cash advance 2", transaction_date=timezone.now().date(),
        remaining_balance=Decimal("2000.00"), status=CreditLogStatus.ACTIVE
    )

    # Deduct ₹1500 (should exhaust log1 and take ₹500 from log2)
    expenses = CreditLogsService.deduct_credit(
        organization=org, user=admin, amount=Decimal("1500.00"),
        description="Worker Cash Upad", date=timezone.now().date(), transaction_id="TXN-TEST-1"
    )

    assert len(expenses) == 2
    log1.refresh_from_db()
    log2.refresh_from_db()

    assert log1.remaining_balance == Decimal("0.00")
    assert log1.status == CreditLogStatus.FULLY_UTILIZED
    assert log2.remaining_balance == Decimal("1500.00")
    assert log2.status == CreditLogStatus.ACTIVE

    # Test reversal restores balance and reverts status
    CreditLogsService.reverse_credit_deduction(organization=org, transaction_id="TXN-TEST-1")
    log1.refresh_from_db()
    log2.refresh_from_db()

    assert log1.remaining_balance == Decimal("1000.00")
    assert log1.status == CreditLogStatus.ACTIVE
    assert log2.remaining_balance == Decimal("2000.00")


def test_insufficient_credit_throws_error(test_setup):
    """Section 4.5 step 3: If requestedAmount > totalAvailable: THROW 'Insufficient credit balance'."""
    org = test_setup["org"]
    admin = test_setup["admin1"]

    CreditLog.objects.create(
        organization=org, credited_by=admin, amount=Decimal("500.00"),
        description="Small cash", transaction_date=timezone.now().date(),
        remaining_balance=Decimal("500.00"), status=CreditLogStatus.ACTIVE
    )

    with pytest.raises(BusinessRuleError, match="Insufficient cash credit balance"):
        CreditLogsService.deduct_credit(
            organization=org, user=admin, amount=Decimal("600.00"),
            description="Exceeding cash", date=timezone.now().date()
        )


def test_upad_payment_creation_and_duplicate_detection(test_setup):
    """Section 1.4 A step 4: 60-second duplicate payment prevention."""
    org = test_setup["org"]
    admin = test_setup["admin1"]
    emp = test_setup["employee"]

    # Provide cash credit first
    CreditLog.objects.create(
        organization=org, credited_by=admin, amount=Decimal("5000.00"),
        description="Pool", transaction_date=timezone.now().date(),
        remaining_balance=Decimal("5000.00"), status=CreditLogStatus.ACTIVE
    )

    pay = UpadPaymentService.create_payment(
        data={
            "employee_id": emp.id,
            "amount": "2000.00",
            "type": PaymentType.ADVANCE,
            "method": PaymentMethod.CASH,
            "status": PaymentLifecycleStatus.PAID,
            "description": "Weekly Advance",
        },
        user=admin,
        organization=org,
    )
    assert pay.status == PaymentLifecycleStatus.PAID
    assert pay.amount == Decimal("2000.00")

    # Immediate second payment of same amount must be rejected as duplicate
    with pytest.raises(BusinessRuleError, match="Duplicate payment detected"):
        UpadPaymentService.create_payment(
            data={
                "employee_id": emp.id,
                "amount": "2000.00",
                "type": PaymentType.ADVANCE,
                "method": PaymentMethod.CASH,
                "status": PaymentLifecycleStatus.PAID,
            },
            user=admin,
            organization=org,
        )


def test_upad_self_approval_forbidden(test_setup):
    """Section 1.5: Self-approval is forbidden - a different admin must approve."""
    org = test_setup["org"]
    admin1 = test_setup["admin1"]
    admin2 = test_setup["admin2"]
    emp = test_setup["employee"]
    proj = test_setup["project"]

    # Mark attendance so wages can be paid
    Attendance.objects.create(
        organization=org,
        employee=emp,
        project=proj,
        date=timezone.localdate(),
        status=AttendanceStatus.PRESENT,
        marked_by=admin1,
    )

    # Admin1 creates pending payment
    pay = UpadPaymentService.create_payment(
        data={
            "employee_id": emp.id,
            "project_id": proj.id,
            "amount": "1500.00",
            "type": PaymentType.SALARY,
            "method": PaymentMethod.BANK_TRANSFER,
            "status": PaymentLifecycleStatus.PENDING,
            "description": "Salary pending",
        },
        user=admin1,
        organization=org,
    )

    # Admin1 cannot approve own payment
    with pytest.raises(BusinessRuleError, match="Self-approval is forbidden"):
        UpadPaymentService.approve_payment(payment_id=pay.id, user=admin1, organization=org)

    # Admin2 can approve
    approved = UpadPaymentService.approve_payment(payment_id=pay.id, user=admin2, organization=org)
    assert approved.status == PaymentLifecycleStatus.APPROVED
    assert approved.approved_by == admin2


def test_running_cost_creation_without_credit_dependency(test_setup):
    """Cash running cost is recorded directly without gating on Cash Credit module."""
    org = test_setup["org"]
    admin = test_setup["admin1"]
    proj = test_setup["project"]

    rc = RunningCostService.create_running_cost(
        data={
            "project_id": proj.id,
            "amount": "400.00",
            "description": "Cement bags",
            "payment_method": "cash",
        },
        user=admin,
        organization=org,
    )
    assert rc.id is not None
    assert rc.amount == Decimal("400.00")

