"""
End-to-End Acceptance Test for Workflow 4: Vendor Credit Lifecycle (Phase P8).
Covers:
1. ENG receives material on 30-day credit: POST /api/v1/expenses with payment_mode=CREDIT, vendor, and due_date.
2. PM approves expense: DR 5001 Material Expense / CR 2001 Accounts Payable posted, vendor outstanding balance increases.
3. Dashboard overview (GET /api/v1/dashboard/overview) flags UNPAID_VENDOR_DUE alert once past due date.
4. ACC views vendor ledger (GET /api/v1/vendors/{id}/ledger) and records repayment (POST /api/v1/vendors/{id}/payments):
   DR 2001 Accounts Payable / CR 1002 Bank posted; vendor balance falls.
5. Verification of final trial balance and alert resolution.
"""

from datetime import date
from decimal import Decimal
from io import BytesIO

import pytest
from accounts.services import (
    accept_invitation,
    create_organization,
    create_user_invitation,
)
from core.roles import Role
from expenses.models import ExpenseCategory, ExpenseStatus, PaymentMode, Vendor
from ledger.models import Side
from ledger.services import post_journal_entry, trial_balance
from PIL import Image
from projects.models import ProjectStatus
from projects.services import add_project_member, create_project
from rest_framework import status
from rest_framework.test import APIClient


def _make_dummy_image_file():
    img = Image.new("RGB", (50, 50), color="green")
    buf = BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    buf.name = "receipt.jpg"
    return buf


@pytest.mark.django_db
class TestWorkflow4VendorCreditLifecycle:
    def setup_method(self):
        self.org, _, self.tok = create_organization(
            name="Apex Zenith Construction Ltd",
            admin_email="admin@apexzenith.test",
        )
        self.admin, _ = accept_invitation(self.tok, "AdminPass123#", "Admin Zenith")

        # Create PM, ENG, and ACC
        _, pm_tok = create_user_invitation(
            self.org, "pm@apexzenith.test", Role.PROJECT_MANAGER, self.admin
        )
        self.pm, _ = accept_invitation(pm_tok, "PMPass123#", "Site PM")

        _, eng_tok = create_user_invitation(
            self.org, "eng@apexzenith.test", Role.SITE_ENGINEER, self.admin
        )
        self.eng, _ = accept_invitation(eng_tok, "EngPass123#", "Site Engineer")

        _, acc_tok = create_user_invitation(
            self.org, "acc@apexzenith.test", Role.ACCOUNTANT, self.admin
        )
        self.acc, _ = accept_invitation(acc_tok, "AccPass123#", "Head Accountant")

        # Project
        self.project = create_project(
            self.org,
            self.admin,
            {
                "name": "Zenith Commercial Plaza",
                "code": "PRJ-ZCP",
                "estimated_budget": Decimal("25000000.00"),
                "status": ProjectStatus.ACTIVE,
            },
        )
        add_project_member(self.project, self.pm, site_role="Site PM")
        add_project_member(self.project, self.eng, site_role="Site Engineer")

        # Bank capital injection
        post_journal_entry(
            org=self.org,
            date=date(2026, 10, 1),
            description="Initial Capital Contribution",
            lines=[
                {"account_code": "1002", "side": Side.DR, "amount": "500000.00"},
                {"account_code": "3001", "side": Side.CR, "amount": "500000.00"},
            ],
            user=self.admin,
        )

        # Create Vendor: Ultratech Cement
        self.vendor = Vendor.objects.create(
            organization=self.org,
            name="Ultratech Cement Suppliers",
            contact_person="Manoj Agarwal",
            phone="+91 98200 44444",
            email="orders@ultratechdealers.test",
        )

        self.eng_client = APIClient()
        self.eng_client.force_authenticate(user=self.eng)

        self.pm_client = APIClient()
        self.pm_client.force_authenticate(user=self.pm)

        self.acc_client = APIClient()
        self.acc_client.force_authenticate(user=self.acc)

        self.admin_client = APIClient()
        self.admin_client.force_authenticate(user=self.admin)

    def test_workflow_4_credit_lifecycle(self):
        purchase_date = date(2026, 10, 1)
        due_date = date(
            2026, 10, 5
        )  # Set due date in the past relative to today (simulating overdue)

        # ----------------------------------------------------------------------
        # Step 1: ENG Records Credit Purchase from Vendor
        # ----------------------------------------------------------------------
        exp_res = self.eng_client.post(
            "/api/v1/expenses",
            {
                "project": self.project.id,
                "vendor": self.vendor.id,
                "category": ExpenseCategory.MATERIAL,
                "description": "500 bags of OPC 53 Grade Cement on Credit",
                "amount": "80000.00",
                "expense_date": str(purchase_date),
                "due_date": str(due_date),
                "payment_mode": PaymentMode.CREDIT,
                "receipt": _make_dummy_image_file(),
            },
            format="multipart",
        )
        assert exp_res.status_code == status.HTTP_201_CREATED
        expense_id = exp_res.data["id"]

        # Above org limit (1000) -> PENDING_APPROVAL
        assert exp_res.data["status"] == ExpenseStatus.PENDING_APPROVAL

        # ----------------------------------------------------------------------
        # Step 2: PM Approves Credit Purchase -> Posts Journal & Raises Vendor Balance
        # ----------------------------------------------------------------------
        appr_res = self.pm_client.post(
            f"/api/v1/expenses/{expense_id}/approve",
            {},
            format="json",
        )
        assert appr_res.status_code == status.HTTP_200_OK

        # Vendor outstanding balance is now 80,000.00
        self.vendor.refresh_from_db()
        assert self.vendor.outstanding_balance == Decimal("80000.00")

        # ----------------------------------------------------------------------
        # Step 3: Overdue Bill Flags UNPAID_VENDOR_DUE Alert in Dashboard Overview
        # ----------------------------------------------------------------------
        dash_res = self.admin_client.get("/api/v1/dashboard/overview?refresh=true")
        assert dash_res.status_code == status.HTTP_200_OK

        alerts = dash_res.data.get("alerts", [])
        vendor_alerts = [a for a in alerts if a.get("type") == "UNPAID_VENDOR_DUE"]
        assert len(vendor_alerts) >= 1
        assert vendor_alerts[0]["vendor_id"] == self.vendor.id

        # ----------------------------------------------------------------------
        # Step 4: ACC Reviews Vendor Ledger & Records Repayment
        # ----------------------------------------------------------------------
        # A) Check vendor statement
        stmt_res = self.acc_client.get(f"/api/v1/vendors/{self.vendor.id}/ledger")
        assert stmt_res.status_code == status.HTTP_200_OK
        assert stmt_res.data["closing_balance"] == "80000.00"

        # B) ACC pays vendor 50,000 via Bank Transfer
        repay_res = self.acc_client.post(
            f"/api/v1/vendors/{self.vendor.id}/payments",
            {
                "project": self.project.id,
                "amount": "50000.00",
                "payment_date": str(date(2026, 10, 6)),
                "payment_mode": PaymentMode.BANK_TRANSFER,
                "reference": "RTGS-UT-50000",
                "notes": "Part-payment for October cement delivery",
            },
            format="json",
        )
        assert repay_res.status_code == status.HTTP_201_CREATED

        # Vendor balance falls to 30,000.00
        self.vendor.refresh_from_db()
        assert self.vendor.outstanding_balance == Decimal("30000.00")

        # Statement closing balance reflects new balance
        stmt2_res = self.acc_client.get(f"/api/v1/vendors/{self.vendor.id}/ledger")
        assert stmt2_res.data["closing_balance"] == "30000.00"

        # C) ACC clears remainder 30,000 via Bank Transfer
        repay2_res = self.acc_client.post(
            f"/api/v1/vendors/{self.vendor.id}/payments",
            {
                "project": self.project.id,
                "amount": "30000.00",
                "payment_date": str(date(2026, 10, 7)),
                "payment_mode": PaymentMode.BANK_TRANSFER,
                "reference": "RTGS-UT-30000-FINAL",
            },
            format="json",
        )
        assert repay2_res.status_code == status.HTTP_201_CREATED

        # Outstanding balance is now zero
        self.vendor.refresh_from_db()
        assert self.vendor.outstanding_balance == Decimal("0.00")

        # ----------------------------------------------------------------------
        # Step 5: Verify Trial Balance Remains Fully Balanced
        # ----------------------------------------------------------------------
        tb_data = trial_balance(self.org)
        assert tb_data["is_balanced"] is True
        assert tb_data["total_debit"] == tb_data["total_credit"]

        # Alert no longer present because vendor balance is zero
        dash2_res = self.admin_client.get("/api/v1/dashboard/overview?refresh=true")
        vendor_alerts_cleared = [
            a
            for a in dash2_res.data.get("alerts", [])
            if a.get("type") == "UNPAID_VENDOR_DUE" and a.get("vendor_id") == self.vendor.id
        ]
        assert len(vendor_alerts_cleared) == 0
