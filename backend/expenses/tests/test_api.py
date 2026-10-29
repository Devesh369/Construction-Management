"""
API integration tests for Expenses, Vendors, and Baselines (Phase P5).
Tests status codes, permissions, multi-tenancy, and validation error payloads.
"""

import io
from datetime import date
from decimal import Decimal

import pytest
from accounts.services import accept_invitation, create_organization, create_user_invitation
from core.roles import Role
from PIL import Image
from projects.services import add_project_member, create_project
from rest_framework import status
from rest_framework.test import APIClient

from expenses.models import (
    Expense,
    ExpenseCategory,
    ExpenseStatus,
    PaymentMode,
    UtilityType,
    Vendor,
)


def _make_dummy_image_file():
    img = Image.new("RGB", (50, 50), color="red")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    buf.name = "receipt.jpg"
    return buf


@pytest.mark.django_db
class TestExpensesAPI:
    def setup_method(self):
        # Tenant 1: Alpha
        self.org, self.invite, self.token = create_organization("Alpha Corp", "admin@alpha.test")
        self.admin, _ = accept_invitation(self.token, "AdminPass123#", "Admin Alpha")

        pm_inv, pm_tok = create_user_invitation(
            self.org, "pm@alpha.test", Role.PROJECT_MANAGER, self.admin
        )
        self.pm, _ = accept_invitation(pm_tok, "PMPass123#", "PM Alpha")

        eng_inv, eng_tok = create_user_invitation(
            self.org, "eng@alpha.test", Role.SITE_ENGINEER, self.admin
        )
        self.eng, _ = accept_invitation(eng_tok, "EngPass123#", "Eng Alpha")

        sup_inv, sup_tok = create_user_invitation(
            self.org, "sup@alpha.test", Role.SUPERVISOR, self.admin
        )
        self.sup, _ = accept_invitation(sup_tok, "SupPass123#", "Sup Alpha")

        self.project = create_project(
            self.org,
            user=self.admin,
            data={"name": "Alpha Tower", "code": "ALP-1", "budget": Decimal("10000000.00")},
        )
        add_project_member(self.project, self.pm, site_role="PM")
        add_project_member(self.project, self.eng, site_role="Site Engineer")
        add_project_member(self.project, self.sup, site_role="Supervisor")

        self.vendor = Vendor.objects.create(
            organization=self.org,
            name="Alpha Steel Mart",
            phone="9876543210",
        )

        # Tenant 2: Beta (Isolation testing)
        self.beta_org, _, b_tok = create_organization("Beta Corp", "admin@beta.test")
        self.beta_admin, _ = accept_invitation(b_tok, "BetaPass123#", "Admin Beta")
        self.beta_project = create_project(
            self.beta_org,
            user=self.beta_admin,
            data={"name": "Beta Site", "code": "BET-1", "budget": Decimal("5000000.00")},
        )
        self.beta_vendor = Vendor.objects.create(
            organization=self.beta_org,
            name="Beta Steel",
        )

        self.client = APIClient()

    def test_create_expense_under_limit_auto_approved(self):
        """Expense <= 1000.00 auto-approved at creation."""
        self.client.force_authenticate(user=self.eng)
        payload = {
            "project": self.project.id,
            "category": ExpenseCategory.MATERIAL,
            "description": "Safety helmets and ropes",
            "amount": "850.00",
            "expense_date": "2026-10-01",
            "payment_mode": PaymentMode.CASH,
        }
        res = self.client.post("/api/v1/expenses", data=payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["status"] == ExpenseStatus.APPROVED
        assert res.data["approved_by"] == self.eng.id
        assert res.data["journal_entry"] is not None

    def test_create_expense_above_limit_requires_receipt_and_becomes_pending(self):
        """Expense > 1000.00 requires receipt and gets PENDING_APPROVAL status."""
        self.client.force_authenticate(user=self.eng)

        # Without receipt -> 400 Bad Request
        payload_no_receipt = {
            "project": self.project.id,
            "category": ExpenseCategory.MATERIAL,
            "description": "Cement 100 bags",
            "amount": "35000.00",
            "expense_date": "2026-10-01",
            "payment_mode": PaymentMode.BANK_TRANSFER,
        }
        res_fail = self.client.post("/api/v1/expenses", data=payload_no_receipt, format="json")
        assert res_fail.status_code == status.HTTP_400_BAD_REQUEST

        # With receipt -> 201 Created and status PENDING_APPROVAL
        img_buf = _make_dummy_image_file()
        payload_with_receipt = {
            "project": self.project.id,
            "category": ExpenseCategory.MATERIAL,
            "description": "Cement 100 bags",
            "amount": "35000.00",
            "expense_date": "2026-10-01",
            "payment_mode": PaymentMode.BANK_TRANSFER,
            "receipt": img_buf,
        }
        res_ok = self.client.post("/api/v1/expenses", data=payload_with_receipt, format="multipart")
        assert res_ok.status_code == status.HTTP_201_CREATED
        assert res_ok.data["status"] == ExpenseStatus.PENDING_APPROVAL
        assert res_ok.data["approved_by"] is None

    def test_supervisor_only_transport_category(self):
        """Supervisor trying to log non-TRANSPORT expense is rejected."""
        self.client.force_authenticate(user=self.sup)
        payload = {
            "project": self.project.id,
            "category": ExpenseCategory.MATERIAL,
            "description": "Bricks",
            "amount": "500.00",
            "expense_date": "2026-10-01",
            "payment_mode": PaymentMode.CASH,
        }
        res = self.client.post("/api/v1/expenses", data=payload, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST

        # Transport succeeds
        payload_transport = {
            "project": self.project.id,
            "category": ExpenseCategory.TRANSPORT,
            "description": "Earthmover fuel & transport",
            "amount": "900.00",
            "expense_date": "2026-10-01",
            "payment_mode": PaymentMode.CASH,
            "details": {"vehicle_number": "MH-01-AB-1234", "distance_km": 25},
        }
        res_transport = self.client.post("/api/v1/expenses", data=payload_transport, format="json")
        assert res_transport.status_code == status.HTTP_201_CREATED

    def test_approve_reject_and_cancel_lifecycle(self):
        """PM approves engineer's expense; cancel reverses it."""
        img = _make_dummy_image_file()
        self.client.force_authenticate(user=self.eng)
        create_res = self.client.post(
            "/api/v1/expenses",
            data={
                "project": self.project.id,
                "category": ExpenseCategory.FUEL,
                "description": "Generator fuel",
                "amount": "1500.00",
                "expense_date": "2026-10-02",
                "payment_mode": PaymentMode.UPI,
                "receipt": img,
            },
            format="multipart",
        )
        exp_id = create_res.data["id"]

        # 1. Engineer self-approval blocked
        self.client.force_authenticate(user=self.eng)
        self_appr = self.client.post(f"/api/v1/expenses/{exp_id}/approve")
        assert self_appr.status_code in [
            status.HTTP_403_FORBIDDEN,
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        ]

        # 2. PM approves -> 200 OK
        self.client.force_authenticate(user=self.pm)
        appr_res = self.client.post(f"/api/v1/expenses/{exp_id}/approve")
        assert appr_res.status_code == status.HTTP_200_OK
        assert appr_res.data["status"] == ExpenseStatus.APPROVED

        # 3. PM cancels with reason -> 200 OK
        cancel_res = self.client.post(
            f"/api/v1/expenses/{exp_id}/cancel", data={"reason": "Wrong meter reading"}
        )
        assert cancel_res.status_code == status.HTTP_200_OK
        assert cancel_res.data["status"] == ExpenseStatus.CANCELLED

    def test_vendor_credit_purchase_and_payments_api(self):
        """Credit purchase increases vendor balance; payment reduces it."""
        img = _make_dummy_image_file()
        self.client.force_authenticate(user=self.eng)
        # Credit purchase
        res = self.client.post(
            "/api/v1/expenses",
            data={
                "project": self.project.id,
                "vendor": self.vendor.id,
                "category": ExpenseCategory.MATERIAL,
                "description": "Reinforcement Steel",
                "amount": "40000.00",
                "expense_date": "2026-10-05",
                "payment_mode": PaymentMode.CREDIT,
                "due_date": "2026-11-05",
                "invoice_number": "INV-789",
                "receipt": img,
            },
            format="multipart",
        )
        assert res.status_code == status.HTTP_201_CREATED
        exp_id = res.data["id"]

        # PM approves
        self.client.force_authenticate(user=self.pm)
        self.client.post(f"/api/v1/expenses/{exp_id}/approve")

        # Check vendor balance via API
        v_res = self.client.get(f"/api/v1/vendors/{self.vendor.id}")
        assert v_res.status_code == status.HTTP_200_OK
        assert v_res.data["outstanding_balance"] == "40000.00"

        # Check vendor ledger
        led_res = self.client.get(f"/api/v1/vendors/{self.vendor.id}/ledger")
        assert led_res.status_code == status.HTTP_200_OK
        assert led_res.data["closing_balance"] == "40000.00"
        assert len(led_res.data["entries"]) == 1

        # Repay vendor partially 25000.00
        pay_res = self.client.post(
            f"/api/v1/vendors/{self.vendor.id}/payments",
            data={
                "project": self.project.id,
                "amount": "25000.00",
                "payment_date": "2026-10-15",
                "payment_mode": PaymentMode.BANK_TRANSFER,
                "reference": "RTGS-112233",
            },
            format="json",
        )
        assert pay_res.status_code == status.HTTP_201_CREATED

        # Balance now 15000.00
        v_res2 = self.client.get(f"/api/v1/vendors/{self.vendor.id}")
        assert v_res2.data["outstanding_balance"] == "15000.00"

    def test_running_cost_baselines_upsert_api(self):
        """Upsert utility baselines via API."""
        self.client.force_authenticate(user=self.pm)
        payload = {
            "project": self.project.id,
            "utility_type": UtilityType.ELECTRICITY,
            "monthly_baseline": "15000.00",
        }
        res = self.client.put("/api/v1/running-cost-baselines/upsert", data=payload, format="json")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["monthly_baseline"] == "15000.00"

        list_res = self.client.get("/api/v1/running-cost-baselines")
        assert list_res.status_code == status.HTTP_200_OK
        assert len(list_res.data["results"]) >= 1

    def test_tenant_isolation(self):
        """Beta user cannot access or approve Alpha's expenses or vendors."""
        self.client.force_authenticate(user=self.beta_admin)
        # Attempt to access Alpha's vendor
        res = self.client.get(f"/api/v1/vendors/{self.vendor.id}")
        assert res.status_code == status.HTTP_404_NOT_FOUND

        # Attempt to access Alpha's expense
        exp = Expense.objects.create(
            organization=self.org,
            project=self.project,
            category=ExpenseCategory.MATERIAL,
            description="Alpha secret expense",
            amount=Decimal("500.00"),
            expense_date=date(2026, 10, 1),
            payment_mode=PaymentMode.CASH,
            created_by=self.admin,
        )
        res_exp = self.client.get(f"/api/v1/expenses/{exp.id}")
        assert res_exp.status_code == status.HTTP_404_NOT_FOUND

    def test_transport_expense_auto_defaults_details_via_api(self):
        """Site user can log a transport expense without crashing on missing details."""
        self.client.force_authenticate(user=self.eng)
        payload = {
            "project": self.project.id,
            "category": "TRANSPORT",
            "description": "Local site transport",
            "amount": "333.00",
            "expense_date": "2026-10-23",
            "payment_mode": "CASH",
        }
        res = self.client.post("/api/v1/expenses", data=payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["details"]["vehicle_number"] == "SITE-LOGISTICS"
        assert res.data["details"]["distance_km"] == 0

    def test_credit_expense_missing_vendor_rejected_with_clear_message(self):
        """Credit purchase without vendor returns specific validation message."""
        self.client.force_authenticate(user=self.eng)
        payload = {
            "project": self.project.id,
            "category": "TRANSPORT",
            "description": "Vendor credit transport",
            "amount": "333.00",
            "expense_date": "2026-10-23",
            "payment_mode": "CREDIT",
            "due_date": "2026-10-31",
            "vendor": "",
        }
        res = self.client.post("/api/v1/expenses", data=payload, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "vendor" in res.data["error"]["details"]

    def test_vendor_new_entry_by_site_engineer(self):
        """Site Engineer can register a new vendor."""
        self.client.force_authenticate(user=self.eng)
        payload = {
            "name": "Mahalaxmi Cement Traders",
            "contact_person": "Ramesh Patel",
            "phone": "9825123456",
            "tax_id": "24AAACH7409R1ZZ",
        }
        res = self.client.post("/api/v1/vendors", data=payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["name"] == "Mahalaxmi Cement Traders"
        assert res.data["phone"] == "9825123456"
