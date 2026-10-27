"""
Expenses, Vendors, Payments, and Running Cost Baselines models.
"""

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from core.models import TenantModel
from core.money import q2


class ExpenseCategory(models.TextChoices):
    MATERIAL = "MATERIAL", "Material"
    EQUIPMENT_RENTAL = "EQUIPMENT_RENTAL", "Equipment Rental"
    EQUIPMENT = "EQUIPMENT", "Equipment"
    FUEL = "FUEL", "Fuel"
    TRANSPORT = "TRANSPORT", "Transport"
    UTILITY = "UTILITY", "Utility"
    LABOR = "LABOR", "Labor"
    PETTY_CASH = "PETTY_CASH", "Petty Cash"
    OTHER = "OTHER", "Other"


class PaymentMode(models.TextChoices):
    CASH = "CASH", "Cash"
    UPI = "UPI", "UPI"
    BANK_TRANSFER = "BANK_TRANSFER", "Bank Transfer"
    CREDIT = "CREDIT", "Credit"


class ExpenseStatus(models.TextChoices):
    PENDING_APPROVAL = "PENDING_APPROVAL", "Pending Approval"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"
    CANCELLED = "CANCELLED", "Cancelled"


class UtilityType(models.TextChoices):
    ELECTRICITY = "ELECTRICITY", "Electricity"
    WATER = "WATER", "Water"
    SECURITY = "SECURITY", "Security"
    DUMPSTER = "DUMPSTER", "Dumpster"
    OTHER = "OTHER", "Other"


class Vendor(TenantModel):
    """External vendor or supplier supplying materials, equipment, or services."""

    name = models.CharField(max_length=200)
    contact_person = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    tax_id = models.CharField(max_length=50, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Vendor"
        verbose_name_plural = "Vendors"
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def outstanding_balance(self) -> Decimal:
        """Computed balance: APPROVED CREDIT expenses minus VendorPayments."""
        from django.db.models import Sum

        credit_expenses = self.expenses.filter(
            status=ExpenseStatus.APPROVED,
            payment_mode=PaymentMode.CREDIT,
            deleted_at__isnull=True,
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        payments = self.payments.filter(deleted_at__isnull=True).aggregate(total=Sum("amount"))[
            "total"
        ] or Decimal("0.00")
        return q2(credit_expenses - payments)


class Expense(TenantModel):
    """Site expense record tracking approvals, invoices, and ledger integration."""

    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="expenses"
    )
    vendor = models.ForeignKey(
        Vendor, null=True, blank=True, on_delete=models.SET_NULL, related_name="expenses"
    )
    category = models.CharField(max_length=30, choices=ExpenseCategory.choices)
    description = models.TextField()
    amount = models.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    expense_date = models.DateField()
    payment_mode = models.CharField(max_length=20, choices=PaymentMode.choices)

    invoice_number = models.CharField(max_length=50, blank=True)
    due_date = models.DateField(null=True, blank=True)
    receipt = models.FileField(upload_to="receipts/", null=True, blank=True)
    is_recurring = models.BooleanField(default=False)
    details = models.JSONField(default=dict, blank=True)

    status = models.CharField(
        max_length=20, choices=ExpenseStatus.choices, default=ExpenseStatus.PENDING_APPROVAL
    )
    created_by = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="created_expenses"
    )
    approved_by = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="approved_expenses",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    cancel_reason = models.TextField(blank=True)

    journal_entry = models.ForeignKey(
        "ledger.JournalEntry",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="linked_expenses",
    )

    class Meta:
        verbose_name = "Expense"
        verbose_name_plural = "Expenses"
        ordering = ["-expense_date", "-id"]

    def __str__(self):
        return f"{self.project.code} - {self.category}: {self.amount} ({self.status})"


class VendorPayment(TenantModel):
    """Payment record disbursed to a vendor against outstanding credit or invoices."""

    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE, related_name="payments")
    project = models.ForeignKey(
        "projects.Project",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="vendor_payments",
    )
    amount = models.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    payment_date = models.DateField()
    payment_mode = models.CharField(max_length=20, choices=PaymentMode.choices)
    reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    paid_by = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="payments_made"
    )
    journal_entry = models.ForeignKey(
        "ledger.JournalEntry",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="linked_vendor_payments",
    )

    class Meta:
        verbose_name = "Vendor Payment"
        verbose_name_plural = "Vendor Payments"
        ordering = ["-payment_date", "-id"]

    def __str__(self):
        return f"Payment to {self.vendor.name}: {self.amount}"


class RunningCostBaseline(TenantModel):
    """Monthly utility budget baseline per project."""

    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="running_cost_baselines"
    )
    utility_type = models.CharField(max_length=30, choices=UtilityType.choices)
    monthly_baseline = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        verbose_name = "Running Cost Baseline"
        verbose_name_plural = "Running Cost Baselines"
        unique_together = ("project", "utility_type")
        ordering = ["id"]

    def __str__(self):
        return f"{self.project.code} {self.utility_type} baseline: {self.monthly_baseline}"


class RunningCost(TenantModel):
    """
    Running Costs Module: Day-to-day site operational non-salary costs
    (materials, fuel, equipment rental, food, cement, consumables).
    Directly corresponds to Section 3 of Module Architecture & Workflow Specification.
    """
    date = models.DateField()
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="running_costs"
    )
    amount = models.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    description = models.TextField()
    entered_by = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="running_costs_entered"
    )
    user_name = models.CharField(max_length=200, blank=True)
    user_role = models.CharField(max_length=50, blank=True)
    payment_method = models.CharField(max_length=30, choices=PaymentMode.choices, default=PaymentMode.CASH)

    class Meta:
        verbose_name = "Running Cost"
        verbose_name_plural = "Running Costs"
        ordering = ["-date", "-created_at", "-id"]
        indexes = [
            models.Index(fields=["organization", "project", "date"]),
            models.Index(fields=["organization", "entered_by"]),
        ]

    def __str__(self):
        return f"{self.project.code} Running Cost: ₹{self.amount} ({self.description[:30]})"


class CreditLogStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    FULLY_UTILIZED = "fully_utilized", "Fully Utilized"
    CLOSED = "closed", "Closed"


class CreditLog(TenantModel):
    """
    Credits Module: Manages cash pool available to each admin for site disbursement.
    Implements FIFO deduction and tracking across petty cash advances.
    Directly corresponds to Section 4 of Module Architecture & Workflow Specification.
    """
    transaction_date = models.DateField()
    credited_by = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="cash_credit_logs",
        help_text="Admin who received the cash pool"
    )
    amount = models.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.00"))]
    )
    description = models.TextField()
    project = models.ForeignKey(
        "projects.Project", null=True, blank=True, on_delete=models.SET_NULL, related_name="credit_logs"
    )
    employee = models.ForeignKey(
        "workforce.Employee", null=True, blank=True, on_delete=models.SET_NULL, related_name="credit_logs"
    )
    category = models.CharField(max_length=100, blank=True)
    individual_name = models.CharField(max_length=200, blank=True, help_text="Individual/owner who provided cash")
    payment_method = models.CharField(max_length=30, choices=PaymentMode.choices, default=PaymentMode.CASH)

    amount_spent = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    remaining_balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    last_expense_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=CreditLogStatus.choices, default=CreditLogStatus.ACTIVE)

    def save(self, *args, **kwargs):
        if not self.id and (self.remaining_balance == Decimal("0.00") and self.amount > Decimal("0.00")):
            self.remaining_balance = self.amount
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = "Credit Log"
        verbose_name_plural = "Credit Logs"
        ordering = ["transaction_date", "id"]
        indexes = [
            models.Index(fields=["organization", "credited_by", "status"]),
            models.Index(fields=["organization", "transaction_date"]),
        ]

    def __str__(self):
        return f"Credit Log #{self.id}: {self.credited_by.email} - Avail: ₹{self.remaining_balance}/{self.amount} ({self.status})"


class CreditLogExpense(TenantModel):
    """Sub-document record for each FIFO deduction or manual expense against a CreditLog."""
    credit_log = models.ForeignKey(CreditLog, on_delete=models.CASCADE, related_name="expenses")
    amount = models.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    description = models.TextField()
    date = models.DateField()
    recorded_by = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="recorded_credit_expenses"
    )
    transaction_id = models.CharField(max_length=100, blank=True, help_text="Linked Transaction ID")

    class Meta:
        verbose_name = "Credit Log Expense"
        verbose_name_plural = "Credit Log Expenses"
        ordering = ["date", "id"]

    def __str__(self):
        return f"Credit #{self.credit_log_id} Expense: ₹{self.amount} ({self.description[:30]})"

