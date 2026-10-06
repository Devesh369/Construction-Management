from datetime import date
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import DatabaseError, IntegrityError, connection

from accounts.services import create_organization
from ledger.models import Account, AccountType, JournalEntry, JournalLine, Side
from ledger.services import post_journal_entry


@pytest.mark.django_db
class TestLedgerModels:
    def setup_method(self):
        self.org, _, _ = create_organization("Ledger Model Org", "admin@ledgermodel.test")
        lines = [
            {"account_code": "5001", "side": Side.DR, "amount": Decimal("500.00")},
            {"account_code": "1001", "side": Side.CR, "amount": Decimal("500.00")},
        ]
        self.entry = post_journal_entry(
            org=self.org,
            date=date.today(),
            description="Model test entry",
            lines=lines,
        )
        self.line = self.entry.lines.first()

    def test_journal_entry_instance_cannot_be_updated(self):
        """JournalEntry.save() on existing record raises ValidationError."""
        self.entry.description = "Tampered description"
        with pytest.raises(ValidationError, match="Immutable records cannot be updated"):
            self.entry.save()

    def test_journal_line_instance_cannot_be_updated(self):
        """JournalLine.save() on existing record raises ValidationError."""
        self.line.amount = Decimal("9999.00")
        with pytest.raises(ValidationError, match="Immutable records cannot be updated"):
            self.line.save()

    def test_journal_entry_instance_cannot_be_deleted(self):
        """JournalEntry.delete() raises ValidationError."""
        with pytest.raises(ValidationError, match="Immutable records cannot be deleted"):
            self.entry.delete()

    def test_journal_line_instance_cannot_be_deleted(self):
        """JournalLine.delete() raises ValidationError."""
        with pytest.raises(ValidationError, match="Immutable records cannot be deleted"):
            self.line.delete()

    def test_journal_entry_queryset_update_and_delete_blocked(self):
        """JournalEntry queryset update() and delete() raise ValidationError."""
        with pytest.raises(ValidationError, match="Immutable records cannot be updated"):
            JournalEntry.objects.filter(id=self.entry.id).update(description="Hacked")

        with pytest.raises(ValidationError, match="Immutable records cannot be deleted"):
            JournalEntry.objects.filter(id=self.entry.id).delete()

    def test_journal_line_queryset_update_and_delete_blocked(self):
        """JournalLine queryset update() and delete() raise ValidationError."""
        with pytest.raises(ValidationError, match="Immutable records cannot be updated"):
            JournalLine.objects.filter(id=self.line.id).update(amount=Decimal("1.00"))

        with pytest.raises(ValidationError, match="Immutable records cannot be deleted"):
            JournalLine.objects.filter(id=self.line.id).delete()

    def test_database_trigger_blocks_raw_update_and_delete(self):
        """PostgreSQL database triggers block raw SQL UPDATE and DELETE on journal tables."""
        with connection.cursor() as cursor:
            # Raw SQL UPDATE on entry
            with pytest.raises(DatabaseError):
                cursor.execute(
                    "UPDATE ledger_journalentry SET description = 'Hacked' WHERE id = %s",
                    [self.entry.id],
                )

            # Raw SQL DELETE on entry
            with pytest.raises(DatabaseError):
                cursor.execute(
                    "DELETE FROM ledger_journalentry WHERE id = %s",
                    [self.entry.id],
                )

            # Raw SQL UPDATE on line
            with pytest.raises(DatabaseError):
                cursor.execute(
                    "UPDATE ledger_journalline SET amount = 999.00 WHERE id = %s",
                    [self.line.id],
                )

            # Raw SQL DELETE on line
            with pytest.raises(DatabaseError):
                cursor.execute(
                    "DELETE FROM ledger_journalline WHERE id = %s",
                    [self.line.id],
                )

    def test_account_unique_code_per_org(self):
        """Account codes must be unique within an organization."""
        with pytest.raises(IntegrityError):
            Account.objects.create(
                organization=self.org,
                code="1001",  # Already exists from default chart of accounts
                name="Duplicate Cash",
                type=AccountType.ASSET,
            )
