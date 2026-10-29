"""
Core base models for tenant isolation, soft-deletion, immutability, and document sequences.
"""

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class AliveQuerySet(models.QuerySet):
    """Queryset that provides soft-deletion filtering."""

    def delete(self):
        # Soft delete batch
        return self.update(deleted_at=timezone.now())

    def hard_delete(self):
        # Permanent database deletion
        return super().delete()


class AliveManager(models.Manager):
    """Default manager that excludes soft-deleted records."""

    def get_queryset(self):
        return AliveQuerySet(self.model, using=self._db).filter(deleted_at__isnull=True)


class TenantModel(models.Model):
    """
    Abstract base model for all tenant-scoped entities.
    Every tenant model belongs to an Organization via PROTECT foreign key.
    Includes timestamps and soft delete tracking.
    """

    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.PROTECT,
        related_name="%(app_label)s_%(class)s_set",
        help_text="Owning tenant organization",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = AliveManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False):
        """Soft delete the record by setting deleted_at timestamp."""
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at", "updated_at"])

    def hard_delete(self):
        """Permanently remove the record from the database."""
        super().delete()


class ImmutableQuerySet(models.QuerySet):
    """Queryset for append-only tables that disallows batch updates and deletes."""

    def update(self, **kwargs):
        raise ValidationError("Immutable records cannot be updated.")

    def delete(self):
        raise ValidationError("Immutable records cannot be deleted.")


class ImmutableTenantModel(models.Model):
    """
    Abstract base model for append-only financial and audit records.
    Modifications and deletions are strictly blocked at model and queryset level.
    """

    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.PROTECT,
        related_name="%(app_label)s_%(class)s_set",
        help_text="Owning tenant organization",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ImmutableQuerySet.as_manager()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        # If record already exists in database (has primary key), reject modification
        if self.pk is not None:
            raise ValidationError("Immutable records cannot be updated after creation.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Immutable records cannot be deleted.")


class DocumentSequence(models.Model):
    """
    Race-safe, gap-free document number generator per organization and document type.
    Example keys: 'JE' for Journal Entries, 'EMP' for Employees, 'VCH' for Payroll Vouchers.
    """

    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.PROTECT,
        related_name="document_sequences",
    )
    key = models.CharField(max_length=20)
    last_value = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("organization", "key")

    def __str__(self):
        return f"{self.organization_id} - {self.key}: {self.last_value}"
