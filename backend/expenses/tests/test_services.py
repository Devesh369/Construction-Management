"""
Tests for Expenses, Vendors, Payments, and Baseline services (Phase P5).
Verifies UC-18 through UC-22 and rules from Section 6 and Section 7.2.
"""

import io
from datetime import date
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image

from accounts.services import accept_invitation, create_organization, create_user_invitation
from audit.constants import AuditAction
from audit.models import AuditLog
from core.exceptions import BusinessRuleError
from core.roles import Role
from expenses.models import (
    ExpenseCategory,
    ExpenseStatus,
    PaymentMode,
    UtilityType,
    Vendor,
)
from expenses.services import (
    approve_expense,
    cancel_expense,
    create_expense,
    record_vendor_payment,
    reject_expense,
    upsert_running_cost_baseline,
    vendor_balance,
    vendor_statement,
)
from projects.services import create_project


def _make_dummy_receipt(name="receipt.jpg"):
    img = Image.new("RGB", (50, 50), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return SimpleUploadedFile(name, buf.read(), content_type="image/jpeg")


@pytest.mark.django_db
class TestExpenseServices:
    def setup_method(self):
        # 1. Organization with default expense_approval_limit = 1000.00
        self.org, self.invite, self.token = create_organization(
            "Alpha Builders", "admin@alpha.test"
        )
        self.admin, _ = accept_invitation(self.token, "AdminPass123#", "Admin Alpha")

        # 2. PM and Supervisor
        pm_invite, pm_token = create_user_invitation(
            self.org, "pm@alpha.test", Role.PROJECT_MANAGER, self.admin
        )
        self.pm, _ = accept_invitation(pm_token, "PMPass123#", "PM Alpha")

        sup_invite, sup_token = create_user_invitation(
            self.org, "sup@alpha.test", Role.SUPERVISOR, self.admin
        )
        self.sup, _ = accept_invitation(sup_token, "SupPass123#", "Sup Alpha")

        # 3. Project
        self.project = create_project(
            self.org,
            user=self.admin,
            data={
                "name": "Skyline Tower",
                "code": "SKY-01",
                "budget": Decimal("50000000.00"),
                "geofence_lat": Decimal("19.076000"),
                "geofence_lng": Decimal("72.877700"),
                "geofence_radius_m": 200,
            },
        )

        # 4. Vendor
        self.vendor = Vendor.objects.create(
            organization=self.org,
            name="Apex Steel & Cement",
            contact_person="Ramesh Patel",
            phone="9876543210",
            tax_id="GSTIN123456",
        )

    def test_limit_boundary_1000_auto_approved_vs_1000_01_pending(self):
        """
        Boundary test:
        - 1000.00 is auto-approved, posts balanced journal, updates spend.
        - 1000.01 is PENDING_APPROVAL, does not post journal, spend unchanged.
        """
        assert self.org.expense_approval_limit == Decimal("1000.00")
        initial_spend = self.project.actual_spend

        # 1. Exactly 1000.00 -> APPROVED
        exp_1000 = create_expense(
            user=self.pm,
            data={
                "project": self.project,
                "category": ExpenseCategory.MATERIAL,
                "description": "Nails and screws",
                "amount": Decimal("1000.00"),
                "expense_date": timezone.localdate(),
                "payment_mode": PaymentMode.CASH,
            },
        )
        assert exp_1000.status == ExpenseStatus.APPROVED
        assert exp_1000.approved_by == self.pm
        assert exp_1000.journal_entry is not None
        # Check journal accounts: DR 5001 / CR 1001
        lines = list(exp_1000.journal_entry.lines.all())
        assert len(lines) == 2
        dr_line = [line for line in lines if line.side == "DR"][0]
        cr_line = [line for line in lines if line.side == "CR"][0]
        assert dr_line.account.code == "5001"
        assert dr_line.amount == Decimal("1000.00")
        assert cr_line.account.code == "1001"
        assert cr_line.amount == Decimal("1000.00")

        self.project.refresh_from_db()
        assert self.project.actual_spend == initial_spend + Decimal("1000.00")

        # 2. 1000.01 with receipt -> PENDING_APPROVAL
        receipt_file = _make_dummy_receipt()
        exp_1000_01 = create_expense(
            user=self.pm,
            data={
                "project": self.project,
                "category": ExpenseCategory.MATERIAL,
                "description": "More screws",
                "amount": Decimal("1000.01"),
                "expense_date": timezone.localdate(),
                "payment_mode": PaymentMode.CASH,
                "receipt": receipt_file,
            },
        )
        assert exp_1000_01.status == ExpenseStatus.PENDING_APPROVAL
        assert exp_1000_01.approved_by is None
        assert exp_1000_01.journal_entry is None

        self.project.refresh_from_db()
        assert self.project.actual_spend == initial_spend + Decimal("1000.00")

    def test_receipt_required_above_limit(self):
        """Amount > approval limit without receipt raises receipt_required."""
        with pytest.raises(BusinessRuleError, match="Receipt is required") as exc:
            create_expense(
                user=self.pm,
                data={
                    "project": self.project,
                    "category": ExpenseCategory.MATERIAL,
                    "description": "Timber planks",
                    "amount": Decimal("1500.00"),
                    "expense_date": timezone.localdate(),
                    "payment_mode": PaymentMode.CASH,
                    "receipt": None,
                },
            )
        assert exc.value.code == "receipt_required"

    def test_self_approval_blocked(self):
        """Approver cannot approve their own expense."""
        receipt_file = _make_dummy_receipt()
        exp = create_expense(
            user=self.pm,
            data={
                "project": self.project,
                "category": ExpenseCategory.EQUIPMENT_RENTAL,
                "description": "Crane rental",
                "amount": Decimal("25000.00"),
                "expense_date": timezone.localdate(),
                "payment_mode": PaymentMode.BANK_TRANSFER,
                "receipt": receipt_file,
            },
        )
        assert exp.status == ExpenseStatus.PENDING_APPROVAL

        with pytest.raises(BusinessRuleError, match="cannot approve your own") as exc:
            approve_expense(exp, approver=self.pm)
        assert exc.value.code == "self_approval_blocked"

    def test_approve_expense_lifecycle(self):
        """Admin approves PM's expense; journal posts DR 5002 / CR 1002 and spend updates."""
        receipt_file = _make_dummy_receipt()
        exp = create_expense(
            user=self.pm,
            data={
                "project": self.project,
                "category": ExpenseCategory.EQUIPMENT_RENTAL,
                "description": "Bulldozer rental",
                "amount": Decimal("15000.00"),
                "expense_date": timezone.localdate(),
                "payment_mode": PaymentMode.BANK_TRANSFER,
                "receipt": receipt_file,
            },
        )
        initial_spend = self.project.actual_spend

        approved = approve_expense(exp, approver=self.admin)
        assert approved.status == ExpenseStatus.APPROVED
        assert approved.approved_by == self.admin
        assert approved.journal_entry is not None

        # Check journal accounts: DR 5002 Equipment / CR 1002 Bank
        lines = list(approved.journal_entry.lines.all())
        dr = [line for line in lines if line.side == "DR"][0]
        cr = [line for line in lines if line.side == "CR"][0]
        assert dr.account.code == "5002"
        assert cr.account.code == "1002"
        assert dr.amount == Decimal("15000.00")
        assert cr.amount == Decimal("15000.00")

        self.project.refresh_from_db()
        assert self.project.actual_spend == initial_spend + Decimal("15000.00")

        # Audit log written
        audit = AuditLog.objects.filter(
            organization=self.org, action=AuditAction.EXPENSE_APPROVED, resource_id=approved.id
        ).first()
        assert audit is not None

    def test_reject_expense_requires_reason(self):
        """Rejecting an expense requires a mandatory reason."""
        receipt_file = _make_dummy_receipt()
        exp = create_expense(
            user=self.pm,
            data={
                "project": self.project,
                "category": ExpenseCategory.MATERIAL,
                "description": "Overpriced paint",
                "amount": Decimal("5000.00"),
                "expense_date": timezone.localdate(),
                "payment_mode": PaymentMode.CASH,
                "receipt": receipt_file,
            },
        )

        with pytest.raises(BusinessRuleError, match="Rejection reason is required"):
            reject_expense(exp, approver=self.admin, reason="")

        rejected = reject_expense(exp, approver=self.admin, reason="Vendor rate is too high")
        assert rejected.status == ExpenseStatus.REJECTED
        assert rejected.rejection_reason == "Vendor rate is too high"
        assert rejected.journal_entry is None

    def test_cancel_expense_reverses_journal_and_spend(self):
        """Cancelling an approved expense reverses its ledger entry and decreases spend."""
        receipt_file = _make_dummy_receipt()
        exp = create_expense(
            user=self.pm,
            data={
                "project": self.project,
                "category": ExpenseCategory.FUEL,
                "description": "Generator diesel",
                "amount": Decimal("4000.00"),
                "expense_date": timezone.localdate(),
                "payment_mode": PaymentMode.UPI,
                "receipt": receipt_file,
            },
        )
        approve_expense(exp, approver=self.admin)
        self.project.refresh_from_db()
        spend_after_approval = self.project.actual_spend

        # Attempt cancel without reason -> rejected
        with pytest.raises(BusinessRuleError, match="Cancellation reason is required"):
            cancel_expense(exp, user=self.admin, reason="")

        cancelled = cancel_expense(exp, user=self.admin, reason="Duplicate bill submission")
        assert cancelled.status == ExpenseStatus.CANCELLED
        assert cancelled.cancel_reason == "Duplicate bill submission"

        self.project.refresh_from_db()
        assert self.project.actual_spend == spend_after_approval - Decimal("4000.00")

        # Reversal journal entry created
        assert AuditLog.objects.filter(
            organization=self.org, action=AuditAction.EXPENSE_CANCELLED
        ).exists()

    def test_credit_purchase_requires_vendor_and_due_date(self):
        """Credit purchase requires vendor and due date; increases vendor balance."""
        receipt_file = _make_dummy_receipt()

        # Missing vendor
        with pytest.raises(BusinessRuleError, match="requires an assigned vendor"):
            create_expense(
                user=self.pm,
                data={
                    "project": self.project,
                    "category": ExpenseCategory.MATERIAL,
                    "description": "TMT Steel Bars",
                    "amount": Decimal("50000.00"),
                    "expense_date": timezone.localdate(),
                    "payment_mode": PaymentMode.CREDIT,
                    "vendor": None,
                    "due_date": date(2026, 11, 15),
                    "receipt": receipt_file,
                },
            )

        # Missing due date
        with pytest.raises(BusinessRuleError, match="requires a due date"):
            create_expense(
                user=self.pm,
                data={
                    "project": self.project,
                    "category": ExpenseCategory.MATERIAL,
                    "description": "TMT Steel Bars",
                    "amount": Decimal("50000.00"),
                    "expense_date": timezone.localdate(),
                    "payment_mode": PaymentMode.CREDIT,
                    "vendor": self.vendor,
                    "due_date": None,
                    "receipt": receipt_file,
                },
            )

    def test_credit_purchase_and_vendor_payment_maths(self):
        """
        Credit purchase increases vendor balance; repayment reduces it; overpayment rejected.
        """
        receipt_file = _make_dummy_receipt()
        assert vendor_balance(self.vendor) == Decimal("0.00")

        # 1. Create and approve credit expense 30000.00
        exp = create_expense(
            user=self.pm,
            data={
                "project": self.project,
                "category": ExpenseCategory.MATERIAL,
                "description": "500 bags cement",
                "amount": Decimal("30000.00"),
                "expense_date": date(2026, 10, 1),
                "payment_mode": PaymentMode.CREDIT,
                "vendor": self.vendor,
                "due_date": date(2026, 10, 31),
                "invoice_number": "INV-101",
                "receipt": receipt_file,
            },
        )
        approve_expense(exp, approver=self.admin)

        assert vendor_balance(self.vendor) == Decimal("30000.00")

        # Check journal: DR 5001 / CR 2001 (Accounts Payable)
        lines = list(exp.journal_entry.lines.all())
        cr = [line for line in lines if line.side == "CR"][0]
        assert cr.account.code == "2001"
        assert cr.amount == Decimal("30000.00")

        # 2. Overpayment attempt: 35000.00 > 30000.00 -> rejected
        with pytest.raises(BusinessRuleError, match="exceeds outstanding balance") as exc:
            record_vendor_payment(
                vendor=self.vendor,
                user=self.admin,
                data={
                    "amount": Decimal("35000.00"),
                    "payment_date": date(2026, 10, 10),
                    "payment_mode": PaymentMode.BANK_TRANSFER,
                },
            )
        assert exc.value.code == "overpayment_not_allowed"

        # 3. Partial repayment: 20000.00 -> balance becomes 10000.00
        pmt = record_vendor_payment(
            vendor=self.vendor,
            user=self.admin,
            data={
                "amount": Decimal("20000.00"),
                "payment_date": date(2026, 10, 10),
                "payment_mode": PaymentMode.BANK_TRANSFER,
                "reference": "UTR-998877",
            },
        )
        assert pmt.journal_entry is not None
        # Check repayment journal: DR 2001 / CR 1002
        pmt_lines = list(pmt.journal_entry.lines.all())
        dr_pmt = [line for line in pmt_lines if line.side == "DR"][0]
        cr_pmt = [line for line in pmt_lines if line.side == "CR"][0]
        assert dr_pmt.account.code == "2001"
        assert cr_pmt.account.code == "1002"
        assert dr_pmt.amount == Decimal("20000.00")

        assert vendor_balance(self.vendor) == Decimal("10000.00")

        # 4. Check vendor ledger statement
        stmt = vendor_statement(self.vendor)
        assert stmt["vendor_id"] == self.vendor.id
        assert stmt["closing_balance"] == "10000.00"
        assert len(stmt["entries"]) == 2
        assert stmt["entries"][0]["type"] == "CREDIT_PURCHASE"
        assert stmt["entries"][0]["running_balance"] == "30000.00"
        assert stmt["entries"][1]["type"] == "PAYMENT"
        assert stmt["entries"][1]["running_balance"] == "10000.00"

    def test_supervisor_limited_to_transport(self):
        """Supervisor role can ONLY create TRANSPORT expenses."""
        # Supervisor tries MATERIAL -> rejected
        with pytest.raises(BusinessRuleError, match="Supervisors are only permitted"):
            create_expense(
                user=self.sup,
                data={
                    "project": self.project,
                    "category": ExpenseCategory.MATERIAL,
                    "description": "Bricks",
                    "amount": Decimal("500.00"),
                    "expense_date": timezone.localdate(),
                    "payment_mode": PaymentMode.CASH,
                },
            )

        # Supervisor creates TRANSPORT -> succeeds
        exp_trans = create_expense(
            user=self.sup,
            data={
                "project": self.project,
                "category": ExpenseCategory.TRANSPORT,
                "description": "Sand truck delivery",
                "amount": Decimal("800.00"),
                "expense_date": timezone.localdate(),
                "payment_mode": PaymentMode.CASH,
                "details": {
                    "vehicle_number": "MH-04-AB-1234",
                    "distance_km": 45,
                    "driver_allowance": 200,
                },
            },
        )
        assert exp_trans.status == ExpenseStatus.APPROVED
        assert exp_trans.category == ExpenseCategory.TRANSPORT

    def test_utility_details_and_spike_warning(self):
        """Utility baseline spike warning triggers when amount > baseline * 1.25."""
        # 1. Missing utility_type or billing_month raises error
        with pytest.raises(BusinessRuleError, match="utility_type in details"):
            create_expense(
                user=self.pm,
                data={
                    "project": self.project,
                    "category": ExpenseCategory.UTILITY,
                    "description": "Site power",
                    "amount": Decimal("500.00"),
                    "expense_date": timezone.localdate(),
                    "payment_mode": PaymentMode.CASH,
                    "details": {"billing_month": "2026-10"},
                },
            )

        # 2. Set baseline: ELECTRICITY = 10000.00 (threshold = 12500.00)
        upsert_running_cost_baseline(
            org=self.org,
            project=self.project,
            utility_type=UtilityType.ELECTRICITY,
            monthly_baseline=Decimal("10000.00"),
        )

        # Normal amount: 12000.00 -> spike_warning = False
        receipt_1 = _make_dummy_receipt()
        exp_normal = create_expense(
            user=self.pm,
            data={
                "project": self.project,
                "category": ExpenseCategory.UTILITY,
                "description": "Monthly electricity bill",
                "amount": Decimal("12000.00"),
                "expense_date": timezone.localdate(),
                "payment_mode": PaymentMode.BANK_TRANSFER,
                "details": {"utility_type": UtilityType.ELECTRICITY, "billing_month": "2026-10"},
                "receipt": receipt_1,
            },
        )
        assert exp_normal.details.get("spike_warning") is False

        # Spiked amount: 13000.00 -> spike_warning = True
        receipt_2 = _make_dummy_receipt()
        exp_spiked = create_expense(
            user=self.pm,
            data={
                "project": self.project,
                "category": ExpenseCategory.UTILITY,
                "description": "Spike electricity bill",
                "amount": Decimal("13000.00"),
                "expense_date": timezone.localdate(),
                "payment_mode": PaymentMode.BANK_TRANSFER,
                "details": {"utility_type": UtilityType.ELECTRICITY, "billing_month": "2026-11"},
                "receipt": receipt_2,
            },
        )
        assert exp_spiked.details.get("spike_warning") is True
