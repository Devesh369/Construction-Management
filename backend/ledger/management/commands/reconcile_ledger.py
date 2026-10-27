"""
Management command: reconcile_ledger
Audits and reconciles double-entry ledger invariants, trial balance,
balance sheet, and AP / Worker Advance subledgers across all tenants or a specified organization.
"""

from django.core.management.base import BaseCommand, CommandError

from accounts.models import Organization
from ledger.services import reconcile_ledger


class Command(BaseCommand):
    help = "Audit and reconcile double-entry ledger invariants, trial balance, balance sheet, and subledgers."

    def add_arguments(self, parser):
        parser.add_argument(
            "--org",
            type=str,
            help="Organization ID or Name to reconcile. Defaults to all active organizations.",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Display verbose output including detailed entry lists.",
        )
        parser.add_argument(
            "--fix",
            action="store_true",
            help="Automatically fix reconcilable discrepancies by posting missing double-entry journal entries.",
        )

    def handle(self, *args, **options):
        org_filter = options.get("org")
        verbose = options.get("verbose")
        auto_fix = options.get("fix")

        if org_filter:
            if org_filter.isdigit():
                orgs = Organization.objects.filter(id=int(org_filter))
            else:
                orgs = Organization.objects.filter(name__icontains=org_filter)
            if not orgs.exists():
                raise CommandError(f"No organization found matching '{org_filter}'.")
        else:
            orgs = Organization.objects.filter(is_active=True).order_by("id")

        if not orgs.exists():
            self.stdout.write(self.style.WARNING("No organizations found in the database."))
            return

        self.stdout.write("=" * 70)
        self.stdout.write(self.style.MIGRATE_HEADING(" FINANCIAL LEDGER RECONCILIATION AUDIT"))
        self.stdout.write("=" * 70)

        total_orgs = orgs.count()
        passed_orgs = 0
        failed_orgs = 0

        for org in orgs:
            self.stdout.write(f"\nAuditing Tenant: {org.name} (ID: {org.id})")
            self.stdout.write("-" * 60)

            result = reconcile_ledger(org)

            # Auto-fix unlinked advances if requested
            if (
                auto_fix
                and not result["subledger_reconciliation"]["worker_advances"]["is_reconciled"]
            ):
                from ledger.models import ReferenceType, Side
                from ledger.services import post_journal_entry
                from payroll.models import Advance

                unlinked_advances = Advance.objects.filter(
                    organization=org,
                    journal_entry__isnull=True,
                    deleted_at__isnull=True,
                )
                for unlinked in unlinked_advances:
                    credit_acct = "1001" if unlinked.payment_mode == "CASH" else "1002"
                    lines = [
                        {
                            "account_code": "1100",
                            "side": Side.DR,
                            "amount": unlinked.amount,
                            "memo": f"Advance to {unlinked.employee.employee_code} ({unlinked.employee.full_name})",
                        },
                        {
                            "account_code": credit_acct,
                            "side": Side.CR,
                            "amount": unlinked.amount,
                            "memo": f"Advance disbursement via {unlinked.payment_mode}",
                        },
                    ]
                    je = post_journal_entry(
                        org=org,
                        date=unlinked.advance_date,
                        description=f"Advance #{unlinked.id} to {unlinked.employee.employee_code}",
                        lines=lines,
                        reference_type=ReferenceType.ADVANCE,
                        reference_id=unlinked.id,
                        user=unlinked.given_by,
                        project=unlinked.project,
                    )
                    unlinked.journal_entry = je
                    unlinked.save(update_fields=["journal_entry"])
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"  [FIXED] Posted journal entry {je.entry_number} for Advance #{unlinked.id}."
                        )
                    )

                # Re-run after fix
                result = reconcile_ledger(org)

            is_healthy = result["is_healthy"]

            # 1. Journal Entries
            je = result["journal_entries"]
            je_status = (
                self.style.SUCCESS("[OK]")
                if len(je["invalid_entries"]) == 0
                else self.style.ERROR("[FAIL]")
            )
            self.stdout.write(
                f"  {je_status} Journal Entries: {je['total_audited']} entries audited ({len(je['invalid_entries'])} invalid)"
            )
            if verbose and je["invalid_entries"]:
                for inv in je["invalid_entries"]:
                    self.stdout.write(
                        self.style.ERROR(f"       * {inv['entry_number']}: {inv['reason']}")
                    )

            # 2. Trial Balance
            tb = result["trial_balance"]
            tb_status = (
                self.style.SUCCESS("[OK]") if tb["is_balanced"] else self.style.ERROR("[FAIL]")
            )
            self.stdout.write(
                f"  {tb_status} Trial Balance: DR ₹{tb['total_debit']} | CR ₹{tb['total_credit']}"
            )

            # 3. Balance Sheet
            bs = result["balance_sheet"]
            bs_status = (
                self.style.SUCCESS("[OK]") if bs["is_balanced"] else self.style.ERROR("[FAIL]")
            )
            self.stdout.write(
                f"  {bs_status} Balance Sheet: Assets ₹{bs['total_assets']} | Liab+Eq ₹{bs['total_liabilities_and_equity']}"
            )

            # 4. Subledgers
            sub = result["subledger_reconciliation"]
            ap = sub["accounts_payable"]
            ap_status = (
                self.style.SUCCESS("[OK]") if ap["is_reconciled"] else self.style.ERROR("[FAIL]")
            )
            self.stdout.write(
                f"  {ap_status} Subledger Accounts Payable (2001): GL ₹{ap['gl_balance']} vs Subledger ₹{ap['subledger_balance']} (Diff: ₹{ap['discrepancy']})"
            )

            adv = sub["worker_advances"]
            adv_status = (
                self.style.SUCCESS("[OK]") if adv["is_reconciled"] else self.style.ERROR("[FAIL]")
            )
            self.stdout.write(
                f"  {adv_status} Subledger Worker Advances (1100): GL ₹{adv['gl_balance']} vs Subledger ₹{adv['subledger_balance']} (Diff: ₹{adv['discrepancy']})"
            )

            if is_healthy:
                passed_orgs += 1
                self.stdout.write(
                    self.style.SUCCESS("  RESULT: HEALTHY (All invariants verified)\n")
                )
            else:
                failed_orgs += 1
                self.stdout.write(self.style.ERROR("  RESULT: DISCREPANCIES DETECTED\n"))

        self.stdout.write("=" * 70)
        self.stdout.write(
            f"Reconciliation Summary: {total_orgs} Audited | {passed_orgs} Healthy | {failed_orgs} Discrepancies"
        )
        self.stdout.write("=" * 70)

        if failed_orgs > 0:
            raise CommandError(
                f"Reconciliation failed with discrepancies in {failed_orgs} organization(s)."
            )
        else:
            self.stdout.write(
                self.style.SUCCESS("All tenant financial ledgers are 100% healthy and balanced.")
            )
