"""
Accounts models: Organization (tenant), custom User, Invitation, and PasswordResetToken.
"""

from decimal import Decimal

from core.models import TenantModel
from core.roles import Role
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    """Custom manager for email-based authentication."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set.")
        email = self.normalize_email(email).lower()
        extra_fields.setdefault("is_active", True)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        # Platform superusers have no organization assigned
        extra_fields.setdefault("organization", None)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class Organization(models.Model):
    """
    The tenant organization entity.
    All tenant models link to an Organization via organization_id.
    """

    name = models.CharField(max_length=200, unique=True)
    address = models.TextField(blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=50, blank=True)
    logo = models.ImageField(upload_to="org_logos/", null=True, blank=True)
    currency = models.CharField(max_length=3, default="INR")

    # Working hours and overtime settings
    workday_hours = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=Decimal("8.00"),
        help_text="Hours that constitute a full working day",
    )
    half_day_hours = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=Decimal("4.00"),
        help_text="Worked below this at check-out results in HALF_DAY status",
    )
    overtime_after_hours = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=Decimal("8.00"),
        help_text="Hours above this threshold count as overtime",
    )
    expense_approval_limit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("1000.00"),
        help_text="Expenses above this require explicit manager approval",
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Organization"
        verbose_name_plural = "Organizations"
        ordering = ["name"]

    def __str__(self):
        return self.name


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom user model authenticated via email.
    Belongs to an Organization (null only for superusers).
    """

    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="users",
        help_text="Associated organization (null for platform superuser)",
    )
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=50, blank=True)
    role = models.CharField(
        max_length=30,
        choices=Role.choices,
        default=Role.PROJECT_MANAGER,
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    # Security and lockout tracking
    failed_login_count = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    token_version = models.PositiveIntegerField(
        default=0,
        help_text="Incremented on password change or revocation to invalidate old JWTs",
    )
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.email} ({self.role})"

    def get_full_name(self):
        return self.name or self.email

    def get_short_name(self):
        return self.name or self.email

    def clean(self):
        super().clean()
        if self.email:
            self.email = self.email.lower()

    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.email.lower()
        super().save(*args, **kwargs)


class Invitation(TenantModel):
    """
    Team invitation token. Single-use, expires in 7 days.
    Stores SHA-256 hash of the generated token.
    """

    email = models.EmailField()
    name = models.CharField(max_length=150, blank=True)
    role = models.CharField(max_length=30, choices=Role.choices)
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    invited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invitations_sent",
    )

    class Meta:
        verbose_name = "Invitation"
        verbose_name_plural = "Invitations"
        ordering = ["-created_at"]

    def is_valid(self):
        return self.used_at is None and timezone.now() < self.expires_at

    def __str__(self):
        return f"Invite for {self.email} ({self.role})"


class PasswordResetToken(models.Model):
    """
    Password reset token. Single-use, expires in 1 hour.
    Stores SHA-256 hash of the reset token.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="password_reset_tokens",
    )
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Password Reset Token"
        verbose_name_plural = "Password Reset Tokens"
        ordering = ["-created_at"]

    def is_valid(self):
        return self.used_at is None and timezone.now() < self.expires_at

    def __str__(self):
        return f"Reset token for {self.user.email}"
