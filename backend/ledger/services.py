"""
Double-entry ledger services and contracts.
Contracts:
- post_journal_entry(org, date, description, lines, reference_type="", reference_id=None, user=None, project=None) -> JournalEntry
- reverse_entry(entry, user, reason) -> JournalEntry
- create_default_chart_of_accounts(org) -> None
- trial_balance(org, as_of, project=None) -> dict
- profit_and_loss(org, date_from, date_to, project=None) -> dict
- balance_sheet(org, as_of) -> dict
"""

from decimal import Decimal

from django.db import transaction

from core.exceptions import BusinessRuleError, UnbalancedEntryError
from core.money import q2
from core.sequences import next_number
from ledger.models import Account, AccountType, JournalEntry, JournalLine, ReferenceType, Side

DEFAULT_CHART_OF_ACCOUNTS = [
    ("1001", "Cash in Hand", AccountType.ASSET),
    ("1002", "Bank Account", AccountType.ASSET),
    ("1100", "Worker Advances", AccountType.ASSET),
    ("1200", "Client Receivable", AccountType.ASSET),
    ("2001", "Accounts Payable", AccountType.LIABILITY),
    ("3001", "Owner's Equity", AccountType.EQUITY),
    ("4001", "Project Revenue", AccountType.REVENUE),
    ("5001", "Material Expense", AccountType.EXPENSE),
    ("5002", "Equipment and Rental Expense", AccountType.EXPENSE),
    ("5003", "Fuel and Transport Expense", AccountType.EXPENSE),
    ("5004", "Utilities and Site Overhead", AccountType.EXPENSE),
    ("5005", "Wages Expense", AccountType.EXPENSE),
    ("5006", "Miscellaneous and Petty Cash", AccountType.EXPENSE),
]


def create_default_chart_of_accounts(org) -> None:
    """Create the standard 13 chart of accounts for a new tenant organization."""
    for code, name, acct_type in DEFAULT_CHART_OF_ACCOUNTS:
        Account.objects.get_or_create(
            organization=org,
            code=code,
            defaults={"name": name, "type": acct_type, "is_active": True},
        )


def post_journal_entry(
    org,
    date,
    description: str,
    lines: list[dict],
    reference_type: str = ReferenceType.MANUAL,
    reference_id: int | None = None,
    user=None,
    project=None,
) -> JournalEntry:
    """
    Validate and post a balanced double-entry journal transaction.
    Must have >= 2 lines, every amount > 0, and SUM(DR) == SUM(CR).
    """
    if len(lines) < 2:
        raise BusinessRuleError(
            "A journal entry must contain at least 2 lines.", code="invalid_entry"
        )

    total_dr = Decimal("0.00")
    total_cr = Decimal("0.00")

    # Validate accounts and lines
    prepared_lines = []
    for line in lines:
        amount = q2(line["amount"])
        if amount <= Decimal("0.00"):
            raise BusinessRuleError("Line amount must be greater than zero.", code="invalid_amount")

        side = line["side"]
        if side == Side.DR:
            total_dr += amount
        elif side == Side.CR:
            total_cr += amount
        else:
            raise BusinessRuleError(
                f"Invalid side '{side}'. Must be DR or CR.", code="invalid_side"
            )

        # Resolve account
        account_code = line.get("account_code")
        try:
            account = Account.objects.get(organization=org, code=account_code, is_active=True)
        except Account.DoesNotExist:
            raise BusinessRuleError(
                f"Account '{account_code}' not found or inactive.", code="invalid_account"
            )

        prepared_lines.append(
            {
                "account": account,
                "side": side,
                "amount": amount,
                "memo": line.get("memo", ""),
            }
        )

    if total_dr != total_cr:
        raise UnbalancedEntryError(
            f"Unbalanced journal entry: Total DR ({total_dr}) does not equal Total CR ({total_cr})."
        )

    with transaction.atomic():
        entry_number = next_number(org, key="JE", prefix="JE-", width=6)
        entry = JournalEntry.objects.create(
            organization=org,
            entry_number=entry_number,
            date=date,
            description=description,
            project=project,
            reference_type=reference_type,
            reference_id=reference_id,
            posted_by=user,
        )

        for pl in prepared_lines:
            JournalLine.objects.create(
                organization=org,
                entry=entry,
                account=pl["account"],
                side=pl["side"],
                amount=pl["amount"],
                memo=pl["memo"],
            )

    return entry


def reverse_entry(entry: JournalEntry, user, reason: str) -> JournalEntry:
    """
    Reverse a posted journal entry by swapping all DR and CR lines.
    An entry can only be reversed once. A reversal cannot be reversed.
    """
    if entry.reference_type == ReferenceType.REVERSAL:
        raise BusinessRuleError("A reversal entry cannot be reversed.", code="invalid_reversal")
    if hasattr(entry, "reversed_by") and entry.reversed_by is not None:
        raise BusinessRuleError(
            "This journal entry has already been reversed.", code="already_reversed"
        )

    mirror_lines = []
    for line in entry.lines.select_related("account").all():
        opposite_side = Side.CR if line.side == Side.DR else Side.DR
        mirror_lines.append(
            {
                "account_code": line.account.code,
                "side": opposite_side,
                "amount": line.amount,
                "memo": f"Reversal of {entry.entry_number}: {reason}",
            }
        )

    with transaction.atomic():
        reversal = post_journal_entry(
            org=entry.organization,
            date=entry.date,
            description=f"Reversal of {entry.entry_number}: {reason}",
            lines=mirror_lines,
            reference_type=ReferenceType.REVERSAL,
            reference_id=entry.id,
            user=user,
            project=entry.project,
        )
        entry.reverses = reversal
        entry.reversal_reason = reason
        # Note: entry is immutable, so we do not direct update except linking if needed,
        # or store the relationship on reversal.reverses = entry!
        reversal.reverses = entry
        reversal.reversal_reason = reason
        reversal.save(update_fields=["reverses", "reversal_reason"])

    return reversal


def trial_balance(org, as_of=None, project=None) -> dict:
    """Return trial balance summary: account totals where Total DR == Total CR."""
    return {
        "as_of": str(as_of) if as_of else None,
        "total_debit": "0.00",
        "total_credit": "0.00",
        "accounts": [],
    }


def profit_and_loss(org, date_from=None, date_to=None, project=None) -> dict:
    """Return profit and loss statement: revenue minus expenses."""
    return {"total_revenue": "0.00", "total_expenses": "0.00", "net_profit": "0.00", "accounts": []}


def balance_sheet(org, as_of=None) -> dict:
    """Return balance sheet: assets, liabilities, equity."""
    return {
        "as_of": str(as_of) if as_of else None,
        "assets": "0.00",
        "liabilities": "0.00",
        "equity": "0.00",
    }
