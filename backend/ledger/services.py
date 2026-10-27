"""
Double-entry ledger services and financial statements.
Contracts:
- post_journal_entry(org, date, description, lines, reference_type="", reference_id=None, user=None, project=None, reverses=None, reversal_reason="") -> JournalEntry
- reverse_entry(entry, user, reason) -> JournalEntry
- create_default_chart_of_accounts(org) -> None
- get_account_balance(account, as_of=None) -> Decimal
- account_statement(org, account_identifier, date_from=None, date_to=None) -> dict
- trial_balance(org, as_of=None, project=None) -> dict
- profit_and_loss(org, date_from=None, date_to=None, project=None) -> dict
- balance_sheet(org, as_of=None) -> dict
- reconcile_ledger(org) -> dict
"""

from decimal import Decimal

from django.db import models, transaction

from audit.constants import AuditAction
from audit.services import log_action
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
    reverses=None,
    reversal_reason: str = "",
) -> JournalEntry:
    """
    Validate and post a balanced double-entry journal transaction.
    Must have >= 2 lines, every amount > 0, active accounts, and SUM(DR) == SUM(CR).
    Entire posting (entry + lines + sequence) runs in a single atomic transaction.
    """
    if len(lines) < 2:
        raise BusinessRuleError(
            "A journal entry must contain at least 2 lines.", code="invalid_entry"
        )

    total_dr = Decimal("0.00")
    total_cr = Decimal("0.00")

    prepared_lines = []
    for line in lines:
        amount = q2(Decimal(str(line.get("amount", "0"))))
        if amount <= Decimal("0.00"):
            raise BusinessRuleError("Line amount must be greater than zero.", code="invalid_amount")

        side = line.get("side")
        if side == Side.DR:
            total_dr += amount
        elif side == Side.CR:
            total_cr += amount
        else:
            raise BusinessRuleError(
                f"Invalid side '{side}'. Must be DR or CR.", code="invalid_side"
            )

        # Resolve account: supports account_code or account_id or account object
        account_code = line.get("account_code")
        account_id = line.get("account_id") or line.get("account")
        account = None
        if account_code:
            try:
                account = Account.objects.get(
                    organization=org, code=str(account_code), is_active=True
                )
            except Account.DoesNotExist:
                raise BusinessRuleError(
                    f"Account code '{account_code}' not found or inactive.", code="invalid_account"
                )
        elif account_id:
            if isinstance(account_id, Account):
                account = account_id
            else:
                try:
                    account = Account.objects.get(organization=org, id=account_id, is_active=True)
                except Account.DoesNotExist:
                    raise BusinessRuleError(
                        f"Account ID '{account_id}' not found or inactive.", code="invalid_account"
                    )
        else:
            raise BusinessRuleError(
                "Each journal line requires an account.", code="missing_account"
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
            reverses=reverses,
            reversal_reason=reversal_reason,
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
    Reverse a posted journal entry by generating a mirror entry with swapped DR/CR lines.
    An entry can only be reversed once. A reversal cannot be reversed.
    """
    if entry.reference_type == ReferenceType.REVERSAL:
        raise BusinessRuleError("A reversal entry cannot be reversed.", code="invalid_reversal")

    if JournalEntry.objects.filter(reverses=entry).exists():
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
            reverses=entry,
            reversal_reason=reason,
        )

        log_action(
            user=user,
            action=AuditAction.JOURNAL_REVERSED,
            obj=reversal,
            changes={"reversed_entry_id": entry.id, "reason": reason},
            organization=entry.organization,
        )

    return reversal


def get_account_balance(account: Account, as_of=None) -> Decimal:
    """
    Compute current balance for an account:
    - ASSET / EXPENSE: SUM(DR) - SUM(CR)
    - LIABILITY / EQUITY / REVENUE: SUM(CR) - SUM(DR)
    """
    qs = JournalLine.objects.filter(account=account)
    if as_of:
        qs = qs.filter(entry__date__lte=as_of)

    dr = qs.filter(side=Side.DR).aggregate(total=models.Sum("amount"))["total"] or Decimal("0.00")
    cr = qs.filter(side=Side.CR).aggregate(total=models.Sum("amount"))["total"] or Decimal("0.00")

    if account.type in [AccountType.ASSET, AccountType.EXPENSE]:
        return q2(dr - cr)
    else:
        return q2(cr - dr)


def account_statement(org, account_identifier, date_from=None, date_to=None) -> dict:
    """
    Generate account ledger statement with opening balance, chronologically ordered
    lines, running balance, and closing balance.
    """
    # Resolve account by code first, then by id
    account = Account.objects.filter(organization=org, code=str(account_identifier)).first()
    if not account and str(account_identifier).isdigit():
        account = Account.objects.filter(organization=org, id=int(account_identifier)).first()
    if not account:
        raise BusinessRuleError("Account not found.", code="account_not_found")

    # Opening balance prior to date_from
    opening_balance = Decimal("0.00")
    if date_from:
        prior_lines = JournalLine.objects.filter(account=account, entry__date__lt=date_from)
        prior_dr = prior_lines.filter(side=Side.DR).aggregate(t=models.Sum("amount"))[
            "t"
        ] or Decimal("0.00")
        prior_cr = prior_lines.filter(side=Side.CR).aggregate(t=models.Sum("amount"))[
            "t"
        ] or Decimal("0.00")
        if account.type in [AccountType.ASSET, AccountType.EXPENSE]:
            opening_balance = prior_dr - prior_cr
        else:
            opening_balance = prior_cr - prior_dr

    # Filter lines in period
    period_lines_qs = (
        JournalLine.objects.filter(account=account)
        .select_related("entry")
        .order_by("entry__date", "entry__created_at", "id")
    )

    if date_from:
        period_lines_qs = period_lines_qs.filter(entry__date__gte=date_from)
    if date_to:
        period_lines_qs = period_lines_qs.filter(entry__date__lte=date_to)

    running = opening_balance
    lines_output = []
    for line in period_lines_qs:
        debit = line.amount if line.side == Side.DR else Decimal("0.00")
        credit = line.amount if line.side == Side.CR else Decimal("0.00")

        if account.type in [AccountType.ASSET, AccountType.EXPENSE]:
            running += debit - credit
        else:
            running += credit - debit

        lines_output.append(
            {
                "id": line.id,
                "date": str(line.entry.date),
                "entry_number": line.entry.entry_number,
                "description": line.entry.description,
                "memo": line.memo,
                "side": line.side,
                "debit": str(q2(debit)),
                "credit": str(q2(credit)),
                "running_balance": str(q2(running)),
            }
        )

    return {
        "account": {
            "id": account.id,
            "code": account.code,
            "name": account.name,
            "type": account.type,
            "is_active": account.is_active,
        },
        "date_from": str(date_from) if date_from else None,
        "date_to": str(date_to) if date_to else None,
        "opening_balance": str(q2(opening_balance)),
        "closing_balance": str(q2(running)),
        "lines": lines_output,
    }


def trial_balance(org, as_of=None, project=None) -> dict:
    """
    Compute trial balance: per-account debit and credit totals.
    Total debits must equal total credits in a double-entry system.
    """
    accounts = Account.objects.filter(organization=org).order_by("code")
    lines_qs = JournalLine.objects.filter(organization=org)

    if as_of:
        lines_qs = lines_qs.filter(entry__date__lte=as_of)
    if project:
        lines_qs = lines_qs.filter(entry__project_id=project)

    total_debit = Decimal("0.00")
    total_credit = Decimal("0.00")
    account_rows = []

    for acc in accounts:
        acc_lines = lines_qs.filter(account=acc)
        dr = acc_lines.filter(side=Side.DR).aggregate(t=models.Sum("amount"))["t"] or Decimal(
            "0.00"
        )
        cr = acc_lines.filter(side=Side.CR).aggregate(t=models.Sum("amount"))["t"] or Decimal(
            "0.00"
        )

        total_debit += dr
        total_credit += cr

        account_rows.append(
            {
                "account_id": acc.id,
                "account_code": acc.code,
                "account_name": acc.name,
                "account_type": acc.type,
                "debit": str(q2(dr)),
                "credit": str(q2(cr)),
            }
        )

    return {
        "as_of": str(as_of) if as_of else None,
        "project": project,
        "total_debit": str(q2(total_debit)),
        "total_credit": str(q2(total_credit)),
        "is_balanced": q2(total_debit) == q2(total_credit),
        "accounts": account_rows,
    }


def profit_and_loss(org, date_from=None, date_to=None, project=None) -> dict:
    """
    Calculate Profit & Loss statement:
    - Revenue accounts: Net Revenue = CR - DR
    - Expense accounts: Net Expense = DR - CR
    - Net Profit = Total Revenue - Total Expenses
    """
    lines_qs = JournalLine.objects.filter(organization=org)
    if date_from:
        lines_qs = lines_qs.filter(entry__date__gte=date_from)
    if date_to:
        lines_qs = lines_qs.filter(entry__date__lte=date_to)
    if project:
        lines_qs = lines_qs.filter(entry__project_id=project)

    rev_accounts = Account.objects.filter(organization=org, type=AccountType.REVENUE).order_by(
        "code"
    )
    exp_accounts = Account.objects.filter(organization=org, type=AccountType.EXPENSE).order_by(
        "code"
    )

    total_revenue = Decimal("0.00")
    revenue_rows = []
    for acc in rev_accounts:
        acc_lines = lines_qs.filter(account=acc)
        dr = acc_lines.filter(side=Side.DR).aggregate(t=models.Sum("amount"))["t"] or Decimal(
            "0.00"
        )
        cr = acc_lines.filter(side=Side.CR).aggregate(t=models.Sum("amount"))["t"] or Decimal(
            "0.00"
        )
        net = cr - dr
        total_revenue += net
        revenue_rows.append(
            {
                "account_id": acc.id,
                "account_code": acc.code,
                "account_name": acc.name,
                "amount": str(q2(net)),
            }
        )

    total_expenses = Decimal("0.00")
    expense_rows = []
    for acc in exp_accounts:
        acc_lines = lines_qs.filter(account=acc)
        dr = acc_lines.filter(side=Side.DR).aggregate(t=models.Sum("amount"))["t"] or Decimal(
            "0.00"
        )
        cr = acc_lines.filter(side=Side.CR).aggregate(t=models.Sum("amount"))["t"] or Decimal(
            "0.00"
        )
        net = dr - cr
        total_expenses += net
        expense_rows.append(
            {
                "account_id": acc.id,
                "account_code": acc.code,
                "account_name": acc.name,
                "amount": str(q2(net)),
            }
        )

    net_profit = total_revenue - total_expenses

    return {
        "date_from": str(date_from) if date_from else None,
        "date_to": str(date_to) if date_to else None,
        "project": project,
        "total_revenue": str(q2(total_revenue)),
        "total_expenses": str(q2(total_expenses)),
        "net_profit": str(q2(net_profit)),
        "revenue_accounts": revenue_rows,
        "expense_accounts": expense_rows,
    }


def balance_sheet(org, as_of=None) -> dict:
    """
    Calculate Balance Sheet statement:
    - Assets: ASSET accounts balance (DR - CR)
    - Liabilities: LIABILITY accounts balance (CR - DR)
    - Equity: EQUITY accounts balance (CR - DR)
    - Current period earnings: Total Revenue (CR - DR) - Total Expenses (DR - CR)
    Equation: Total Assets == Total Liabilities + Total Equity + Current Period Earnings.
    """
    lines_qs = JournalLine.objects.filter(organization=org)
    if as_of:
        lines_qs = lines_qs.filter(entry__date__lte=as_of)

    # 1. Assets
    asset_accounts = Account.objects.filter(organization=org, type=AccountType.ASSET).order_by(
        "code"
    )
    total_assets = Decimal("0.00")
    asset_rows = []
    for acc in asset_accounts:
        acc_lines = lines_qs.filter(account=acc)
        dr = acc_lines.filter(side=Side.DR).aggregate(t=models.Sum("amount"))["t"] or Decimal(
            "0.00"
        )
        cr = acc_lines.filter(side=Side.CR).aggregate(t=models.Sum("amount"))["t"] or Decimal(
            "0.00"
        )
        bal = dr - cr
        total_assets += bal
        asset_rows.append(
            {
                "account_id": acc.id,
                "account_code": acc.code,
                "account_name": acc.name,
                "balance": str(q2(bal)),
            }
        )

    # 2. Liabilities
    liab_accounts = Account.objects.filter(organization=org, type=AccountType.LIABILITY).order_by(
        "code"
    )
    total_liabilities = Decimal("0.00")
    liab_rows = []
    for acc in liab_accounts:
        acc_lines = lines_qs.filter(account=acc)
        dr = acc_lines.filter(side=Side.DR).aggregate(t=models.Sum("amount"))["t"] or Decimal(
            "0.00"
        )
        cr = acc_lines.filter(side=Side.CR).aggregate(t=models.Sum("amount"))["t"] or Decimal(
            "0.00"
        )
        bal = cr - dr
        total_liabilities += bal
        liab_rows.append(
            {
                "account_id": acc.id,
                "account_code": acc.code,
                "account_name": acc.name,
                "balance": str(q2(bal)),
            }
        )

    # 3. Equity
    eq_accounts = Account.objects.filter(organization=org, type=AccountType.EQUITY).order_by("code")
    total_equity = Decimal("0.00")
    equity_rows = []
    for acc in eq_accounts:
        acc_lines = lines_qs.filter(account=acc)
        dr = acc_lines.filter(side=Side.DR).aggregate(t=models.Sum("amount"))["t"] or Decimal(
            "0.00"
        )
        cr = acc_lines.filter(side=Side.CR).aggregate(t=models.Sum("amount"))["t"] or Decimal(
            "0.00"
        )
        bal = cr - dr
        total_equity += bal
        equity_rows.append(
            {
                "account_id": acc.id,
                "account_code": acc.code,
                "account_name": acc.name,
                "balance": str(q2(bal)),
            }
        )

    # 4. Current period earnings (Retained Earnings = Revenue - Expenses)
    rev_lines = lines_qs.filter(account__type=AccountType.REVENUE)
    rev_dr = rev_lines.filter(side=Side.DR).aggregate(t=models.Sum("amount"))["t"] or Decimal(
        "0.00"
    )
    rev_cr = rev_lines.filter(side=Side.CR).aggregate(t=models.Sum("amount"))["t"] or Decimal(
        "0.00"
    )
    total_revenue = rev_cr - rev_dr

    exp_lines = lines_qs.filter(account__type=AccountType.EXPENSE)
    exp_dr = exp_lines.filter(side=Side.DR).aggregate(t=models.Sum("amount"))["t"] or Decimal(
        "0.00"
    )
    exp_cr = exp_lines.filter(side=Side.CR).aggregate(t=models.Sum("amount"))["t"] or Decimal(
        "0.00"
    )
    total_expenses = exp_dr - exp_cr

    current_period_earnings = total_revenue - total_expenses
    total_equity_with_earnings = total_equity + current_period_earnings
    total_liabilities_and_equity = total_liabilities + total_equity_with_earnings

    return {
        "as_of": str(as_of) if as_of else None,
        "assets": {
            "accounts": asset_rows,
            "total": str(q2(total_assets)),
        },
        "liabilities": {
            "accounts": liab_rows,
            "total": str(q2(total_liabilities)),
        },
        "equity": {
            "accounts": equity_rows,
            "current_period_earnings": str(q2(current_period_earnings)),
            "total": str(q2(total_equity_with_earnings)),
        },
        "total_assets": str(q2(total_assets)),
        "total_liabilities_and_equity": str(q2(total_liabilities_and_equity)),
        "is_balanced": q2(total_assets) == q2(total_liabilities_and_equity),
    }


def reconcile_ledger(org) -> dict:
    """
    Audit and reconcile double-entry ledger invariants for an organization:
    1. Journal Entry Integrity: each entry has >= 2 lines and SUM(DR) == SUM(CR).
    2. Trial Balance: Total Debits == Total Credits.
    3. Balance Sheet: Total Assets == Total Liabilities + Total Equity + Current Period Earnings.
    4. Subledger Reconciliation:
       - Accounts Payable (2001) GL Balance == Sum of Vendor outstanding balances.
       - Worker Advances (1100) GL Balance == Sum of unadjusted worker advances.
    """
    entries = (
        JournalEntry.objects.filter(organization=org)
        .prefetch_related("lines")
        .order_by("date", "id")
    )
    total_audited = entries.count()
    invalid_entries = []

    for entry in entries:
        lines = list(entry.lines.all())
        if len(lines) < 2:
            invalid_entries.append(
                {
                    "id": entry.id,
                    "entry_number": entry.entry_number,
                    "reason": f"Insufficient lines: expected >= 2, found {len(lines)}",
                }
            )
            continue

        entry_dr = q2(sum((line.amount for line in lines if line.side == Side.DR), Decimal("0.00")))
        entry_cr = q2(sum((line.amount for line in lines if line.side == Side.CR), Decimal("0.00")))
        if entry_dr != entry_cr:
            invalid_entries.append(
                {
                    "id": entry.id,
                    "entry_number": entry.entry_number,
                    "reason": f"Unbalanced lines: DR {entry_dr} != CR {entry_cr}",
                }
            )

    # Trial Balance
    tb = trial_balance(org)

    # Balance Sheet
    bs = balance_sheet(org)

    # Subledger 1: Accounts Payable (2001)
    acct_2001 = Account.objects.filter(organization=org, code="2001").first()
    gl_ap = get_account_balance(acct_2001) if acct_2001 else Decimal("0.00")

    from expenses.models import Vendor

    vendors = Vendor.objects.filter(organization=org, deleted_at__isnull=True)
    sub_ap = q2(sum((v.outstanding_balance for v in vendors), Decimal("0.00")))
    ap_diff = q2(gl_ap - sub_ap)
    ap_reconciled = ap_diff == Decimal("0.00")

    # Subledger 2: Worker Advances (1100)
    acct_1100 = Account.objects.filter(organization=org, code="1100").first()
    gl_adv = get_account_balance(acct_1100) if acct_1100 else Decimal("0.00")

    from payroll.models import Advance

    advances = Advance.objects.filter(
        organization=org,
        deleted_at__isnull=True,
    )
    sub_adv = q2(
        sum((max(Decimal("0.00"), a.amount - a.adjusted_amount) for a in advances), Decimal("0.00"))
    )
    adv_diff = q2(gl_adv - sub_adv)
    adv_reconciled = adv_diff == Decimal("0.00")

    is_healthy = (
        len(invalid_entries) == 0
        and tb["is_balanced"]
        and bs["is_balanced"]
        and ap_reconciled
        and adv_reconciled
    )

    return {
        "organization": {
            "id": org.id,
            "name": org.name,
        },
        "is_healthy": is_healthy,
        "status": "HEALTHY" if is_healthy else "DISCREPANCIES_FOUND",
        "journal_entries": {
            "total_audited": total_audited,
            "invalid_entries": invalid_entries,
        },
        "trial_balance": {
            "total_debit": tb["total_debit"],
            "total_credit": tb["total_credit"],
            "is_balanced": tb["is_balanced"],
        },
        "balance_sheet": {
            "total_assets": bs["total_assets"],
            "total_liabilities_and_equity": bs["total_liabilities_and_equity"],
            "is_balanced": bs["is_balanced"],
        },
        "subledger_reconciliation": {
            "accounts_payable": {
                "account_code": "2001",
                "gl_balance": str(q2(gl_ap)),
                "subledger_balance": str(q2(sub_ap)),
                "discrepancy": str(ap_diff),
                "is_reconciled": ap_reconciled,
            },
            "worker_advances": {
                "account_code": "1100",
                "gl_balance": str(q2(gl_adv)),
                "subledger_balance": str(q2(sub_adv)),
                "discrepancy": str(adv_diff),
                "is_reconciled": adv_reconciled,
            },
        },
    }
