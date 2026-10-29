"""
Payroll models: Worker Advances, Payroll Runs, and Itemized Vouchers.
"""

from decimal import Decimal

from core.models import TenantModel
from django.core.validators import MinValueValidator
from django.db import models


class AdvanceStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    PARTIALLY_ADJUSTED = "PARTIALLY_ADJUSTED", "Partially Adjusted"
    ADJUSTED = "ADJUSTED", "Adjusted"


class PayrollRunStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    APPROVED = "APPROVED", "Approved"
    PAID = "PAID", "Paid"
    CANCELLED = "CANCELLED", "Cancelled"


class VoucherStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    PAID = "PAID", "Paid"


class Advance(TenantModel):
    """Cash advance given to a worker, later deducted via FIFO against payroll vouchers."""

    employee = models.ForeignKey(
        "workforce.Employee", on_delete=models.CASCADE, related_name="advances"
    )
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="advances"
    )
    amount = models.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    advance_date = models.DateField()
    reason = models.TextField(blank=True)
    payment_mode = models.CharField(max_length=20, default="CASH")
    given_by = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="given_advances"
    )
    adjusted_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(
        max_length=25, choices=AdvanceStatus.choices, default=AdvanceStatus.OPEN
    )
    journal_entry = models.ForeignKey(
        "ledger.JournalEntry",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="linked_advances",
    )

    @property
    def remaining_amount(self) -> Decimal:
        return self.amount - self.adjusted_amount

    class Meta:
        verbose_name = "Advance"
        verbose_name_plural = "Advances"
        ordering = ["-advance_date", "-id"]

    def __str__(self):
        return f"{self.employee.employee_code} Advance: {self.amount} ({self.status})"


class PayrollRun(TenantModel):
    """Periodic payroll run for a project aggregating vouchers and posting ledger journal."""

    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="payroll_runs"
    )
    period_start = models.DateField()
    period_end = models.DateField()
    status = models.CharField(
        max_length=20, choices=PayrollRunStatus.choices, default=PayrollRunStatus.DRAFT
    )
    created_by = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="created_payroll_runs"
    )
    approved_by = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="approved_payroll_runs",
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    total_gross = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total_advances = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total_net = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    journal_entry = models.ForeignKey(
        "ledger.JournalEntry",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="linked_payroll_runs",
    )
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Payroll Run"
        verbose_name_plural = "Payroll Runs"
        ordering = ["-period_end"]

    def __str__(self):
        return (
            f"{self.project.code} Payroll {self.period_start} to {self.period_end} ({self.status})"
        )


class PayrollVoucher(TenantModel):
    """Itemized pay voucher for an individual employee during a payroll run."""

    run = models.ForeignKey(PayrollRun, on_delete=models.CASCADE, related_name="vouchers")
    employee = models.ForeignKey(
        "workforce.Employee", on_delete=models.CASCADE, related_name="payroll_vouchers"
    )
    voucher_number = models.CharField(max_length=30)

    # Attendance units
    days_present = models.PositiveIntegerField(default=0)
    half_days = models.PositiveIntegerField(default=0)
    paid_holidays = models.PositiveIntegerField(default=0)
    ot_hours = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))

    # Calculated rates and wages
    daily_rate_used = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    ot_rate_used = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    basic_pay = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    ot_pay = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    gross_pay = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    advances_deducted = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    net_pay = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    payment_mode = models.CharField(max_length=20, default="CASH")
    status = models.CharField(
        max_length=20, choices=VoucherStatus.choices, default=VoucherStatus.PENDING
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_reference = models.CharField(max_length=100, blank=True)

    class Meta:
        verbose_name = "Payroll Voucher"
        verbose_name_plural = "Payroll Vouchers"
        ordering = ["id"]

    def __str__(self):
        return f"{self.voucher_number}: {self.employee.full_name} - Net: {self.net_pay}"


class PaymentType(models.TextChoices):
    SALARY = "salary", "Salary"
    ADVANCE = "advance", "Advance"
    WITHDRAWAL = "withdrawal", "Withdrawal"


class PaymentMethod(models.TextChoices):
    CASH = "cash", "Cash"
    BANK_TRANSFER = "bank_transfer", "Bank Transfer"
    UPI = "upi", "UPI"
    CHEQUE = "cheque", "Cheque"


class PaymentLifecycleStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    PAID = "paid", "Paid"
    REJECTED = "rejected", "Rejected"
    CANCELLED = "cancelled", "Cancelled"


class Payment(TenantModel):
    """
    UPAD Module: Advance Payments, Salary Disbursements, and Worker Withdrawals.
    Corresponds directly to Section 1 of the Module Architecture & Workflow Specification.
    """

    employee = models.ForeignKey(
        "workforce.Employee", on_delete=models.CASCADE, related_name="upad_payments"
    )
    project = models.ForeignKey(
        "projects.Project",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="upad_payments",
    )
    type = models.CharField(max_length=20, choices=PaymentType.choices, default=PaymentType.ADVANCE)
    base_salary = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    expenses = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    amount = models.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    method = models.CharField(
        max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.CASH
    )
    status = models.CharField(
        max_length=20,
        choices=PaymentLifecycleStatus.choices,
        default=PaymentLifecycleStatus.PENDING,
    )
    date_from = models.DateField(null=True, blank=True)
    date_to = models.DateField(null=True, blank=True)
    description = models.CharField(max_length=500, blank=True)

    approved_by = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="approved_upad_payments",
    )
    approved_by_admin_name = models.CharField(max_length=200, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)

    processed_by = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="processed_upad_payments",
    )
    processed_at = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="created_upad_payments"
    )
    transaction_id = models.CharField(
        max_length=100, blank=True, help_text="Linked central ledger transaction ID"
    )

    class Meta:
        verbose_name = "Payment"
        verbose_name_plural = "Payments"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["organization", "employee", "created_at"]),
            models.Index(fields=["organization", "status"]),
        ]

    def __str__(self):
        return f"UPAD {self.id}: {self.employee.full_name} - ₹{self.amount} ({self.status})"
