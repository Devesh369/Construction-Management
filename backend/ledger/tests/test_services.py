from datetime import date
from decimal import Decimal

import pytest

from accounts.services import create_organization
from audit.constants import AuditAction
from audit.models import AuditLog
from core.exceptions import BusinessRuleError, UnbalancedEntryError
from ledger.models import Account, ReferenceType, Side
from ledger.services import (
    account_statement,
    balance_sheet,
    post_journal_entry,
    profit_and_loss,
    reverse_entry,
    trial_balance,
)


@pytest.mark.django_db
class TestLedgerServices:
    def setup_method(self):
        self.org, _, _ = create_organization("Ledger Test Org", "admin@ledgertest.com")

    def test_post_balanced_journal_entry(self):
        """Balanced journal entry is posted with sequential number JE-000001."""
        lines = [
            {
                "account_code": "5001",
                "side": Side.DR,
                "amount": Decimal("1500.00"),
                "memo": "Steel",
            },
            {
                "account_code": "1002",
                "side": Side.CR,
                "amount": Decimal("1500.00"),
                "memo": "Bank payment",
            },
        ]
        entry = post_journal_entry(
            org=self.org,
            date=date(2026, 3, 1),
            description="Purchase of construction materials",
            lines=lines,
        )
        assert entry.entry_number == "JE-000001"
        assert entry.lines.count() == 2
        assert entry.reference_type == ReferenceType.MANUAL

        # Verify lines
        dr_line = entry.lines.get(side=Side.DR)
        cr_line = entry.lines.get(side=Side.CR)
        assert dr_line.account.code == "5001"
        assert dr_line.amount == Decimal("1500.00")
        assert cr_line.account.code == "1002"
        assert cr_line.amount == Decimal("1500.00")

    def test_unbalanced_entry_rejected(self):
        """Unbalanced journal entry raises UnbalancedEntryError."""
        lines = [
            {"account_code": "5001", "side": Side.DR, "amount": Decimal("1000.00")},
            {"account_code": "1002", "side": Side.CR, "amount": Decimal("900.00")},
        ]
        with pytest.raises(UnbalancedEntryError, match="Unbalanced journal entry"):
            post_journal_entry(
                org=self.org,
                date=date.today(),
                description="Unbalanced",
                lines=lines,
            )

    def test_single_line_entry_rejected(self):
        """Entry with fewer than 2 lines raises BusinessRuleError."""
        lines = [
            {"account_code": "5001", "side": Side.DR, "amount": Decimal("100.00")},
        ]
        with pytest.raises(BusinessRuleError, match="at least 2 lines"):
            post_journal_entry(
                org=self.org,
                date=date.today(),
                description="Single line",
                lines=lines,
            )

    def test_zero_or_negative_amount_rejected(self):
        """Line amount must be greater than zero."""
        lines = [
            {"account_code": "5001", "side": Side.DR, "amount": Decimal("0.00")},
            {"account_code": "1002", "side": Side.CR, "amount": Decimal("0.00")},
        ]
        with pytest.raises(BusinessRuleError, match="greater than zero"):
            post_journal_entry(
                org=self.org,
                date=date.today(),
                description="Zero amount",
                lines=lines,
            )

    def test_inactive_or_nonexistent_account_rejected(self):
        """Posting to inactive or non-existent account raises BusinessRuleError."""
        # Nonexistent account
        lines = [
            {"account_code": "9999", "side": Side.DR, "amount": Decimal("100.00")},
            {"account_code": "1001", "side": Side.CR, "amount": Decimal("100.00")},
        ]
        with pytest.raises(BusinessRuleError, match="Account code '9999' not found"):
            post_journal_entry(
                org=self.org,
                date=date.today(),
                description="Invalid account",
                lines=lines,
            )

        # Deactivated account
        acc = Account.objects.get(organization=self.org, code="5006")
        acc.is_active = False
        acc.save()

        lines_deact = [
            {"account_code": "5006", "side": Side.DR, "amount": Decimal("100.00")},
            {"account_code": "1001", "side": Side.CR, "amount": Decimal("100.00")},
        ]
        with pytest.raises(BusinessRuleError, match="inactive"):
            post_journal_entry(
                org=self.org,
                date=date.today(),
                description="Inactive account",
                lines=lines_deact,
            )

    def test_reverse_entry_success(self):
        """Reversing an entry swaps DR/CR and creates an audit log entry."""
        lines = [
            {"account_code": "5001", "side": Side.DR, "amount": Decimal("1200.00")},
            {"account_code": "1001", "side": Side.CR, "amount": Decimal("1200.00")},
        ]
        original = post_journal_entry(
            org=self.org,
            date=date(2026, 3, 5),
            description="Original entry",
            lines=lines,
        )

        reversal = reverse_entry(original, user=None, reason="Mistake in posting")
        assert reversal.reference_type == ReferenceType.REVERSAL
        assert reversal.reference_id == original.id
        assert reversal.reverses == original
        assert reversal.reversal_reason == "Mistake in posting"

        # Check swapped lines
        rev_lines = reversal.lines.all()
        assert rev_lines.get(side=Side.CR).account.code == "5001"
        assert rev_lines.get(side=Side.DR).account.code == "1001"

        # Check audit log
        audit = AuditLog.objects.filter(
            organization=self.org, action=AuditAction.JOURNAL_REVERSED
        ).first()
        assert audit is not None
        assert audit.changes["reversed_entry_id"] == original.id

    def test_cannot_reverse_twice_or_reverse_reversal(self):
        """An entry cannot be reversed twice, and a reversal cannot be reversed."""
        lines = [
            {"account_code": "5001", "side": Side.DR, "amount": Decimal("100.00")},
            {"account_code": "1001", "side": Side.CR, "amount": Decimal("100.00")},
        ]
        original = post_journal_entry(
            org=self.org,
            date=date.today(),
            description="Entry to reverse",
            lines=lines,
        )
        reversal = reverse_entry(original, user=None, reason="First reversal")

        # Try reversing original again
        with pytest.raises(BusinessRuleError, match="already been reversed"):
            reverse_entry(original, user=None, reason="Second reversal attempt")

        # Try reversing the reversal entry
        with pytest.raises(BusinessRuleError, match="reversal entry cannot be reversed"):
            reverse_entry(reversal, user=None, reason="Reverse a reversal")

    def test_account_statement_running_balance(self):
        """Account statement calculates opening balance and chronological running balance."""
        acc_cash = Account.objects.get(organization=self.org, code="1001")

        # Day 1: Deposit capital: DR Cash 10,000 / CR Equity 10,000
        post_journal_entry(
            org=self.org,
            date=date(2026, 1, 1),
            description="Opening capital",
            lines=[
                {"account_code": "1001", "side": Side.DR, "amount": Decimal("10000.00")},
                {"account_code": "3001", "side": Side.CR, "amount": Decimal("10000.00")},
            ],
        )

        # Day 2: Expense: DR Material 2,000 / CR Cash 2,000
        post_journal_entry(
            org=self.org,
            date=date(2026, 1, 15),
            description="Buy cement",
            lines=[
                {"account_code": "5001", "side": Side.DR, "amount": Decimal("2000.00")},
                {"account_code": "1001", "side": Side.CR, "amount": Decimal("2000.00")},
            ],
        )

        # Day 3: Expense: DR Wages 3,000 / CR Cash 3,000
        post_journal_entry(
            org=self.org,
            date=date(2026, 2, 1),
            description="Labor wages",
            lines=[
                {"account_code": "5005", "side": Side.DR, "amount": Decimal("3000.00")},
                {"account_code": "1001", "side": Side.CR, "amount": Decimal("3000.00")},
            ],
        )

        stmt = account_statement(
            self.org, acc_cash.code, date_from=date(2026, 1, 10), date_to=date(2026, 2, 10)
        )
        assert stmt["opening_balance"] == "10000.00"
        assert len(stmt["lines"]) == 2
        # After cement: 10,000 - 2,000 = 8,000
        assert stmt["lines"][0]["running_balance"] == "8000.00"
        # After wages: 8,000 - 3,000 = 5,000
        assert stmt["lines"][1]["running_balance"] == "5000.00"
        assert stmt["closing_balance"] == "5000.00"

    def test_trial_balance_always_balances(self):
        """Trial balance total debits equal total credits."""
        post_journal_entry(
            org=self.org,
            date=date.today(),
            description="Capital injection",
            lines=[
                {"account_code": "1002", "side": Side.DR, "amount": Decimal("50000.00")},
                {"account_code": "3001", "side": Side.CR, "amount": Decimal("50000.00")},
            ],
        )
        post_journal_entry(
            org=self.org,
            date=date.today(),
            description="Fuel expense",
            lines=[
                {"account_code": "5003", "side": Side.DR, "amount": Decimal("4500.00")},
                {"account_code": "1002", "side": Side.CR, "amount": Decimal("4500.00")},
            ],
        )

        tb = trial_balance(self.org)
        assert tb["is_balanced"] is True
        assert tb["total_debit"] == tb["total_credit"]
        assert Decimal(tb["total_debit"]) == Decimal("54500.00")

    def test_profit_and_loss_and_balance_sheet(self):
        """Profit and loss and balance sheet financial statements match double-entry equation."""
        # 1. Capital: DR Bank 100,000 / CR Equity 100,000
        post_journal_entry(
            org=self.org,
            date=date(2026, 1, 1),
            description="Initial Capital",
            lines=[
                {"account_code": "1002", "side": Side.DR, "amount": Decimal("100000.00")},
                {"account_code": "3001", "side": Side.CR, "amount": Decimal("100000.00")},
            ],
        )

        # 2. Revenue: DR Client Receivable 40,000 / CR Project Revenue 40,000
        post_journal_entry(
            org=self.org,
            date=date(2026, 1, 10),
            description="Client billing milestone 1",
            lines=[
                {"account_code": "1200", "side": Side.DR, "amount": Decimal("40000.00")},
                {"account_code": "4001", "side": Side.CR, "amount": Decimal("40000.00")},
            ],
        )

        # 3. Expense: DR Material 15,000 / CR Bank 15,000
        post_journal_entry(
            org=self.org,
            date=date(2026, 1, 15),
            description="Steel & cement",
            lines=[
                {"account_code": "5001", "side": Side.DR, "amount": Decimal("15000.00")},
                {"account_code": "1002", "side": Side.CR, "amount": Decimal("15000.00")},
            ],
        )

        # P&L Check
        pnl = profit_and_loss(self.org, date_from=date(2026, 1, 1), date_to=date(2026, 1, 31))
        assert pnl["total_revenue"] == "40000.00"
        assert pnl["total_expenses"] == "15000.00"
        assert pnl["net_profit"] == "25000.00"

        # Balance Sheet Check
        bs = balance_sheet(self.org, as_of=date(2026, 1, 31))
        assert bs["is_balanced"] is True
        # Assets = Bank (85,000) + Receivable (40,000) = 125,000
        assert bs["total_assets"] == "125000.00"
        # Liabilities = 0
        # Equity = 100,000 + Net Profit (25,000) = 125,000
        assert bs["total_liabilities_and_equity"] == "125000.00"
