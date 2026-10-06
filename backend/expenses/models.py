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
    FUEL = "FUEL", "Fuel"
    TRANSPORT = "TRANSPORT", "Transport"
    UTILITY = "UTILITY", "Utility"
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
    name = models.CharField(max_length=200)
    contact_person = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    tax_id = models.CharField(max_length=50, blank=True)
    is_active = models.BooleanField(default=True)

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

    def __str__(self):
        return f"{self.project.code} - {self.category}: {self.amount} ({self.status})"


class VendorPayment(TenantModel):
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

    def __str__(self):
        return f"Payment to {self.vendor.name}: {self.amount}"


class RunningCostBaseline(TenantModel):
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="running_cost_baselines"
    )
    utility_type = models.CharField(max_length=30, choices=UtilityType.choices)
    monthly_baseline = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        unique_together = ("project", "utility_type")
        ordering = ["id"]

    def __str__(self):
        return f"{self.project.code} {self.utility_type} baseline: {self.monthly_baseline}"
