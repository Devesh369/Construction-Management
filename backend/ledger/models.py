"""
Double-entry ledger models: Account, JournalEntry, JournalLine.
All journal entries and lines inherit ImmutableTenantModel.
"""

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from core.models import ImmutableTenantModel, TenantModel


class AccountType(models.TextChoices):
    ASSET = "ASSET", "Asset"
    LIABILITY = "LIABILITY", "Liability"
    EQUITY = "EQUITY", "Equity"
    REVENUE = "REVENUE", "Revenue"
    EXPENSE = "EXPENSE", "Expense"


class ReferenceType(models.TextChoices):
    EXPENSE = "EXPENSE", "Expense"
    VENDOR_PAYMENT = "VENDOR_PAYMENT", "Vendor Payment"
    ADVANCE = "ADVANCE", "Advance"
    PAYROLL = "PAYROLL", "Payroll"
    MANUAL = "MANUAL", "Manual"
    REVERSAL = "REVERSAL", "Reversal"


class Side(models.TextChoices):
    DR = "DR", "Debit"
    CR = "CR", "Credit"


class Account(TenantModel):
    code = models.CharField(max_length=10)
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=AccountType.choices)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("organization", "code")
        indexes = [
            models.Index(fields=["organization", "code"]),
            models.Index(fields=["organization", "type"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.name} ({self.type})"


class JournalEntry(ImmutableTenantModel):
    entry_number = models.CharField(max_length=30)
    date = models.DateField()
    description = models.TextField()
    project = models.ForeignKey(
        "projects.Project",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="journal_entries",
    )
    reference_type = models.CharField(
        max_length=30,
        choices=ReferenceType.choices,
        default=ReferenceType.MANUAL,
    )
    reference_id = models.PositiveIntegerField(null=True, blank=True)
    posted_by = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="journal_entries_posted",
    )
    reverses = models.OneToOneField(
        "self",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="reversed_by",
    )
    reversal_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["-date", "-created_at"]
        indexes = [
            models.Index(fields=["organization", "date"]),
            models.Index(fields=["organization", "reference_type"]),
        ]

    def __str__(self):
        return f"{self.entry_number}: {self.description[:40]}"


class JournalLine(ImmutableTenantModel):
    entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name="lines")
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="lines")
    side = models.CharField(max_length=2, choices=Side.choices)
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    memo = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["entry", "account"]),
        ]

    def __str__(self):
        return f"{self.side} {self.account.code}: {self.amount}"
