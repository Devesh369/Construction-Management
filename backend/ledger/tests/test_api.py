from decimal import Decimal

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.services import accept_invitation, create_organization, create_user_invitation
from audit.constants import AuditAction
from audit.models import AuditLog
from core.roles import Role
from ledger.models import Account, Side
from ledger.services import post_journal_entry


@pytest.mark.django_db
class TestLedgerAPI:
    def setup_method(self):
        self.client = APIClient()

        # Tenant Alpha
        self.org_alpha, _, tok_adm_a = create_organization("Alpha Build", "admin@alpha.test")
        self.admin_alpha, self.toks_admin_a = accept_invitation(
            tok_adm_a, "AlphaAdmin123#", "Admin Alpha"
        )

        # Accountant in Alpha
        _, tok_acc_a = create_user_invitation(
            self.org_alpha,
            "acc@alpha.test",
            Role.ACCOUNTANT,
            self.admin_alpha,
            name="Accountant Alpha",
        )
        self.acc_alpha, self.toks_acc_a = accept_invitation(
            tok_acc_a, "AlphaAcc123#", "Accountant Alpha"
        )

        # Supervisor in Alpha
        _, tok_sup_a = create_user_invitation(
            self.org_alpha,
            "sup@alpha.test",
            Role.SUPERVISOR,
            self.admin_alpha,
            name="Supervisor Alpha",
        )
        self.sup_alpha, self.toks_sup_a = accept_invitation(
            tok_sup_a, "AlphaSup123#", "Supervisor Alpha"
        )

        # Tenant Beta (for isolation tests)
        self.org_beta, _, tok_adm_b = create_organization("Beta Build", "admin@beta.test")
        self.admin_beta, self.toks_admin_b = accept_invitation(
            tok_adm_b, "BetaAdmin123#", "Admin Beta"
        )

    def test_uc26_accountant_post_manual_journal_entry(self):
        """UC-26: Accountant posts a manual balanced journal entry via API."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_acc_a['access']}")

        payload = {
            "date": "2026-03-01",
            "description": "Opening capital deposit",
            "lines": [
                {
                    "account_code": "1002",
                    "side": Side.DR,
                    "amount": "50000.00",
                    "memo": "Bank deposit",
                },
                {
                    "account_code": "3001",
                    "side": Side.CR,
                    "amount": "50000.00",
                    "memo": "Owner equity",
                },
            ],
        }

        res = self.client.post("/api/v1/ledger/entries", payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["entry_number"].startswith("JE-")
        assert len(res.data["lines"]) == 2

        # Verify audit log was created
        audit = AuditLog.objects.filter(
            organization=self.org_alpha, action=AuditAction.JOURNAL_POSTED_MANUAL
        ).first()
        assert audit is not None
        assert audit.actor == self.acc_alpha

    def test_uc26_accountant_reverse_journal_entry(self):
        """UC-26: Accountant reverses an existing journal entry with a reason."""
        # First post an entry
        entry = post_journal_entry(
            org=self.org_alpha,
            date="2026-03-01",
            description="Entry to be reversed",
            lines=[
                {"account_code": "5001", "side": Side.DR, "amount": Decimal("2500.00")},
                {"account_code": "1001", "side": Side.CR, "amount": Decimal("2500.00")},
            ],
            user=self.acc_alpha,
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_acc_a['access']}")
        res = self.client.post(
            f"/api/v1/ledger/entries/{entry.id}/reverse",
            {"reason": "Incorrect expense category"},
            format="json",
        )
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["reference_type"] == "REVERSAL"
        assert res.data["reverses"] == entry.id
        assert res.data["reversal_reason"] == "Incorrect expense category"

        # Verify audit log
        audit = AuditLog.objects.filter(
            organization=self.org_alpha, action=AuditAction.JOURNAL_REVERSED
        ).first()
        assert audit is not None
        assert audit.actor == self.acc_alpha

    def test_uc27_accountant_view_trial_balance(self):
        """UC-27: Accountant retrieves trial balance; debits equal credits."""
        post_journal_entry(
            org=self.org_alpha,
            date="2026-03-01",
            description="Capital injection",
            lines=[
                {"account_code": "1001", "side": Side.DR, "amount": Decimal("10000.00")},
                {"account_code": "3001", "side": Side.CR, "amount": Decimal("10000.00")},
            ],
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_acc_a['access']}")
        res = self.client.get("/api/v1/ledger/trial-balance")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["is_balanced"] is True
        assert res.data["total_debit"] == res.data["total_credit"]

    def test_uc27_accountant_view_profit_and_loss(self):
        """UC-27: Accountant retrieves P&L statement."""
        # Revenue
        post_journal_entry(
            org=self.org_alpha,
            date="2026-03-05",
            description="Revenue",
            lines=[
                {"account_code": "1002", "side": Side.DR, "amount": Decimal("20000.00")},
                {"account_code": "4001", "side": Side.CR, "amount": Decimal("20000.00")},
            ],
        )
        # Expense
        post_journal_entry(
            org=self.org_alpha,
            date="2026-03-10",
            description="Expense",
            lines=[
                {"account_code": "5001", "side": Side.DR, "amount": Decimal("5000.00")},
                {"account_code": "1002", "side": Side.CR, "amount": Decimal("5000.00")},
            ],
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_acc_a['access']}")
        res = self.client.get("/api/v1/ledger/profit-loss")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["total_revenue"] == "20000.00"
        assert res.data["total_expenses"] == "5000.00"
        assert res.data["net_profit"] == "15000.00"

    def test_uc27_accountant_view_balance_sheet(self):
        """UC-27: Accountant retrieves Balance Sheet; assets equal liabilities and equity."""
        post_journal_entry(
            org=self.org_alpha,
            date="2026-03-01",
            description="Capital injection",
            lines=[
                {"account_code": "1002", "side": Side.DR, "amount": Decimal("50000.00")},
                {"account_code": "3001", "side": Side.CR, "amount": Decimal("50000.00")},
            ],
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_acc_a['access']}")
        res = self.client.get("/api/v1/ledger/balance-sheet")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["is_balanced"] is True
        assert res.data["total_assets"] == res.data["total_liabilities_and_equity"]

    def test_account_statement_endpoint(self):
        """Accountant retrieves running statement for an account."""
        post_journal_entry(
            org=self.org_alpha,
            date="2026-03-01",
            description="Capital injection",
            lines=[
                {"account_code": "1001", "side": Side.DR, "amount": Decimal("8000.00")},
                {"account_code": "3001", "side": Side.CR, "amount": Decimal("8000.00")},
            ],
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_acc_a['access']}")
        res = self.client.get("/api/v1/ledger/account-statement?account=1001")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["closing_balance"] == "8000.00"
        assert len(res.data["lines"]) == 1

    def test_account_deactivation_blocked_if_balance_non_zero(self):
        """Cannot deactivate an account with a non-zero balance."""
        acc_cash = Account.objects.get(organization=self.org_alpha, code="1001")
        post_journal_entry(
            org=self.org_alpha,
            date="2026-03-01",
            description="Initial cash",
            lines=[
                {"account_code": "1001", "side": Side.DR, "amount": Decimal("1000.00")},
                {"account_code": "3001", "side": Side.CR, "amount": Decimal("1000.00")},
            ],
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_acc_a['access']}")
        res = self.client.patch(
            f"/api/v1/ledger/accounts/{acc_cash.id}",
            {"is_active": False},
            format="json",
        )
        assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert "non-zero balance" in str(res.data)

    def test_add_custom_account(self):
        """Accountant can add custom account with unique code."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_acc_a['access']}")
        res = self.client.post(
            "/api/v1/ledger/accounts",
            {"code": "1003", "name": "Secondary Bank", "type": "ASSET"},
            format="json",
        )
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["code"] == "1003"

    def test_ledger_tenant_isolation(self):
        """Org Alpha cannot view Org Beta's accounts or journal entries."""
        # Create an entry in Beta
        entry_beta = post_journal_entry(
            org=self.org_beta,
            date="2026-03-01",
            description="Beta secret entry",
            lines=[
                {"account_code": "1001", "side": Side.DR, "amount": Decimal("500.00")},
                {"account_code": "3001", "side": Side.CR, "amount": Decimal("500.00")},
            ],
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_acc_a['access']}")

        # List should not include Beta's entry
        res_list = self.client.get("/api/v1/ledger/entries")
        results = res_list.data.get("results", res_list.data)
        beta_ids = [e["id"] for e in results if e["id"] == entry_beta.id]
        assert len(beta_ids) == 0

        # Detail on Beta's entry returns 404
        res_detail = self.client.get(f"/api/v1/ledger/entries/{entry_beta.id}")
        assert res_detail.status_code == status.HTTP_404_NOT_FOUND

    def test_supervisor_forbidden_from_ledger(self):
        """Supervisor role is forbidden from ledger endpoints."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_sup_a['access']}")
        res = self.client.get("/api/v1/ledger/accounts")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_reconciliation_api(self):
        """Accountant can fetch financial ledger reconciliation report."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_acc_a['access']}")
        res = self.client.get("/api/v1/ledger/reconciliation")
        assert res.status_code == status.HTTP_200_OK
        assert "is_healthy" in res.data
        assert "status" in res.data
        assert "trial_balance" in res.data
        assert "balance_sheet" in res.data
        assert "subledger_reconciliation" in res.data

        # Supervisor is forbidden
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_sup_a['access']}")
        res_sup = self.client.get("/api/v1/ledger/reconciliation")
        assert res_sup.status_code == status.HTTP_403_FORBIDDEN
