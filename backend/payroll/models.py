"""
Payroll models: Worker Advances, Payroll Runs, and Itemized Vouchers.
"""

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from core.models import TenantModel


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
        ordering = ["-advance_date", "-id"]

    def __str__(self):
        return f"{self.employee.employee_code} Advance: {self.amount} ({self.status})"


class PayrollRun(TenantModel):
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
        ordering = ["-period_end"]

    def __str__(self):
        return (
            f"{self.project.code} Payroll {self.period_start} to {self.period_end} ({self.status})"
        )


class PayrollVoucher(TenantModel):
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
    night_shifts = models.PositiveIntegerField(default=0)

    # Calculated rates and wages
    daily_rate_used = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    ot_rate_used = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    basic_pay = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    ot_pay = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    night_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
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
        ordering = ["id"]

    def __str__(self):
        return f"{self.voucher_number}: {self.employee.full_name} - Net: {self.net_pay}"
