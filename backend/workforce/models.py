"""
Workforce models: Employee directory and LaborGroup (gangs).
"""

from decimal import Decimal

from django.db import models

from core.models import TenantModel
from core.money import q2


class Trade(models.TextChoices):
    KARIGAR = "KARIGAR", "Karigar"
    LABOUR = "LABOUR", "Labour"
    SUPERVISOR = "SUPERVISOR", "Supervisor"
    MASON = "MASON", "Mason"
    CARPENTER = "CARPENTER", "Carpenter"
    ELECTRICIAN = "ELECTRICIAN", "Electrician"
    PLUMBER = "PLUMBER", "Plumber"
    WELDER = "WELDER", "Welder"
    PAINTER = "PAINTER", "Painter"
    HELPER = "HELPER", "Helper"
    OTHER = "OTHER", "Other"


class SkillLevel(models.TextChoices):
    UNSKILLED = "UNSKILLED", "Unskilled"
    SEMI_SKILLED = "SEMI_SKILLED", "Semi-Skilled"
    SKILLED = "SKILLED", "Skilled"


class EmploymentType(models.TextChoices):
    DAILY_WAGE = "DAILY_WAGE", "Daily Wage"
    MONTHLY_SALARY = "MONTHLY_SALARY", "Monthly Salary"


class IdProofType(models.TextChoices):
    AADHAAR = "AADHAAR", "Aadhaar"
    NATIONAL_ID = "NATIONAL_ID", "National ID"
    OTHER = "OTHER", "Other"


class LaborGroup(TenantModel):
    """Gangs / teams led by a foreman (mukkadam)."""

    name = models.CharField(max_length=100)
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="labor_groups",
    )
    leader = models.ForeignKey(
        "Employee",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="led_groups",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.project.code})"


class Employee(TenantModel):
    """Worker and site staff directory record."""

    employee_code = models.CharField(max_length=20)
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=50, blank=True)
    joining_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    trade = models.CharField(max_length=30, choices=Trade.choices, default=Trade.HELPER)
    skill_level = models.CharField(
        max_length=30, choices=SkillLevel.choices, default=SkillLevel.UNSKILLED
    )
    employment_type = models.CharField(
        max_length=30, choices=EmploymentType.choices, default=EmploymentType.DAILY_WAGE
    )

    # Wage rates
    daily_rate = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    ot_hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    monthly_salary = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    # Sensitive payment information (hidden from SUP and ENG)
    bank_account_name = models.CharField(max_length=150, blank=True)
    bank_account_number = models.CharField(max_length=50, blank=True)
    bank_ifsc = models.CharField(max_length=30, blank=True)
    upi_id = models.CharField(max_length=100, blank=True)

    id_proof_type = models.CharField(
        max_length=30, choices=IdProofType.choices, default=IdProofType.AADHAAR
    )
    id_proof_number = models.CharField(max_length=100, blank=True)

    primary_project = models.ForeignKey(
        "projects.Project",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="employees",
    )
    assigned_projects = models.ManyToManyField(
        "projects.Project",
        blank=True,
        related_name="assigned_employees",
    )
    group = models.ForeignKey(
        LaborGroup,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="members",
    )

    # Contact & Profile extensions
    email = models.EmailField(blank=True)
    role = models.CharField(max_length=50, blank=True, default="Karigar")
    address = models.TextField(blank=True)
    emergency_contact = models.CharField(max_length=50, blank=True)
    bank_name = models.CharField(max_length=150, blank=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("organization", "employee_code")
        indexes = [
            models.Index(fields=["organization", "trade"]),
            models.Index(fields=["organization", "is_active"]),
        ]

    def __str__(self):
        return f"{self.employee_code} - {self.full_name}"

    @property
    def effective_daily_rate(self) -> Decimal:
        """
        Computed daily rate for wage calculation:
        daily_rate for DAILY_WAGE; monthly_salary / 30 for MONTHLY_SALARY.
        """
        if self.employment_type == EmploymentType.DAILY_WAGE:
            return q2(self.daily_rate)
        else:
            return q2(self.monthly_salary / Decimal("30.00"))
