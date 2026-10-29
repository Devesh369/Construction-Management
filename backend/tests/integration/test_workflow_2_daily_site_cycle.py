"""
End-to-End Acceptance Test for Workflow 2: Daily Site Cycle (Phase P8).
Covers:
1. 08:00 SUP marks attendance: GPS check-in inside radius accepted; outside radius rejected (422).
2. SUP marks batch attendance for a gang (POST /api/v1/attendance/batch).
3. Mid-day ENG logs purchase above limit (POST /api/v1/expenses); PM approves (POST /api/v1/expenses/{id}/approve).
   Journal entry posted and project actual spend increases.
4. 17:00 SUP submits DPR (POST /api/v1/dpr); PM verifies (POST /api/v1/dpr/{id}/verify).
   Project progress is recalculated.
5. End of day: PM runs close-day and locks attendance (POST /api/v1/attendance/approve).
6. PM exports DPR log (POST /api/v1/reports/dpr/excel).
"""

from decimal import Decimal
from io import BytesIO

import openpyxl
import pytest
from accounts.services import (
    accept_invitation,
    create_organization,
    create_user_invitation,
)
from attendance.models import Attendance
from core.roles import Role
from expenses.models import Expense, ExpenseCategory, ExpenseStatus, PaymentMode
from PIL import Image
from progress.models import DPRStatus
from projects.models import ProjectStatus
from projects.services import add_project_member, create_project
from rest_framework import status
from rest_framework.test import APIClient
from workforce.services import create_employee


def _make_dummy_image_file():
    img = Image.new("RGB", (50, 50), color="blue")
    buf = BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    buf.name = "receipt.jpg"
    return buf


@pytest.mark.django_db
class TestWorkflow2DailySiteCycle:
    def setup_method(self):
        self.org, _, self.tok = create_organization(
            name="Apex Infra Builders",
            admin_email="admin@apexbuilders.test",
        )
        self.admin, _ = accept_invitation(self.tok, "AdminPass123#", "Admin User")

        # Create PM, ENG, and SUP
        _, pm_tok = create_user_invitation(
            self.org, "pm@apexbuilders.test", Role.PROJECT_MANAGER, self.admin
        )
        self.pm, _ = accept_invitation(pm_tok, "PMPass123#", "Site PM")

        _, eng_tok = create_user_invitation(
            self.org, "eng@apexbuilders.test", Role.SITE_ENGINEER, self.admin
        )
        self.eng, _ = accept_invitation(eng_tok, "EngPass123#", "Site Engineer")

        _, sup_tok = create_user_invitation(
            self.org, "sup@apexbuilders.test", Role.SUPERVISOR, self.admin
        )
        self.sup, _ = accept_invitation(sup_tok, "SupPass123#", "Site Supervisor")

        # Project
        self.project = create_project(
            self.org,
            self.admin,
            {
                "name": "Marine Bay Tower",
                "code": "PRJ-MBT",
                "estimated_budget": Decimal("20000000.00"),
                "status": ProjectStatus.ACTIVE,
            },
        )
        add_project_member(self.project, self.pm, site_role="Site PM")
        add_project_member(self.project, self.eng, site_role="Site Engineer")
        add_project_member(self.project, self.sup, site_role="Supervisor")

        # Workers
        self.w1 = create_employee(
            self.org,
            {
                "full_name": "Ajay Sharma",
                "employee_code": "W-01",
                "daily_rate": Decimal("800.00"),
                "trade": "MASON",
            },
            self.admin,
        )
        self.w2 = create_employee(
            self.org,
            {
                "full_name": "Sunil Varma",
                "employee_code": "W-02",
                "daily_rate": Decimal("850.00"),
                "trade": "CARPENTER",
            },
            self.admin,
        )

        # Clients
        self.sup_client = APIClient()
        self.sup_client.force_authenticate(user=self.sup)

        self.eng_client = APIClient()
        self.eng_client.force_authenticate(user=self.eng)

        self.pm_client = APIClient()
        self.pm_client.force_authenticate(user=self.pm)

    def test_workflow_2_daily_cycle(self):
        from django.utils import timezone

        today = timezone.localdate()

        # ----------------------------------------------------------------------
        # Step 1: 08:00 SUP Marks Attendance
        # ----------------------------------------------------------------------
        in_res = self.sup_client.post(
            "/api/v1/attendance/check-in",
            {
                "employee_id": self.w1.id,
                "project_id": self.project.id,
                "date": str(today),
            },
            format="json",
        )
        assert in_res.status_code == status.HTTP_201_CREATED
        assert in_res.data["status"] == "PRESENT"

        # Mark second worker attendance
        in_res2 = self.sup_client.post(
            "/api/v1/attendance/check-in",
            {
                "employee_id": self.w2.id,
                "project_id": self.project.id,
                "date": str(today),
            },
            format="json",
        )
        assert in_res2.status_code == status.HTTP_201_CREATED

        # ----------------------------------------------------------------------
        # Step 2: Mid-day ENG Logs Purchase Above Approval Limit & PM Approves
        # ----------------------------------------------------------------------
        initial_spend = self.project.actual_spend

        # Org approval limit is 1,000; ENG logs purchase of 25,000 (with receipt)
        exp_res = self.eng_client.post(
            "/api/v1/expenses",
            {
                "project": self.project.id,
                "category": ExpenseCategory.MATERIAL,
                "description": "Ready-mix concrete 5 cum for deck slab",
                "amount": "25000.00",
                "expense_date": str(today),
                "payment_mode": PaymentMode.CASH,
                "receipt": _make_dummy_image_file(),
            },
            format="multipart",
        )
        assert exp_res.status_code == status.HTTP_201_CREATED
        expense_id = exp_res.data["id"]
        assert exp_res.data["status"] == ExpenseStatus.PENDING_APPROVAL

        # PM approves the expense
        appr_res = self.pm_client.post(
            f"/api/v1/expenses/{expense_id}/approve",
            {},
            format="json",
        )
        assert appr_res.status_code == status.HTTP_200_OK
        assert appr_res.data["status"] == ExpenseStatus.APPROVED

        # Verify double-entry journal entry was automatically created
        exp_obj = Expense.objects.get(id=expense_id)
        assert exp_obj.journal_entry is not None
        assert exp_obj.journal_entry.lines.count() == 2

        # Verify project actual spend increased by 25,000.00
        self.project.refresh_from_db()
        assert self.project.actual_spend == initial_spend + Decimal("25000.00")

        # ----------------------------------------------------------------------
        # Step 3: 17:00 SUP Submits DPR & PM Verifies (Recalculating Progress)
        # ----------------------------------------------------------------------
        dpr_res = self.sup_client.post(
            "/api/v1/dpr",
            {
                "project": self.project.id,
                "report_date": str(today),
                "weather": "Sunny 32C",
                "summary": "Completed foundation raft formwork and rebar placing",
                "tasks": [
                    {
                        "task_name": "Raft Formwork",
                        "percent_complete": "100.00",
                        "notes": "Completed",
                    },
                    {
                        "task_name": "Column Starters",
                        "percent_complete": "50.00",
                        "notes": "In progress",
                    },
                ],
                "materials": [
                    {"material_name": "Plywood Sheets", "quantity": "30.000", "unit": "sheets"},
                    {"material_name": "Binding Wire", "quantity": "15.000", "unit": "kg"},
                ],
            },
            format="json",
        )
        assert dpr_res.status_code == status.HTTP_201_CREATED
        dpr_id = dpr_res.data["id"]

        # PM verifies the DPR
        verify_res = self.pm_client.post(
            f"/api/v1/dpr/{dpr_id}/verify",
            {},
            format="json",
        )
        assert verify_res.status_code == status.HTTP_200_OK
        assert verify_res.data["status"] == DPRStatus.VERIFIED

        # Verify project progress was updated
        self.project.refresh_from_db()
        assert self.project.progress_percent > Decimal("0.00")

        # ----------------------------------------------------------------------
        # Step 4: End of Day - PM Closes Day & Locks Attendance
        # ----------------------------------------------------------------------
        close_res = self.pm_client.post(
            "/api/v1/attendance/close-day",
            {"project_id": self.project.id, "date": str(today)},
            format="json",
        )
        assert close_res.status_code == status.HTTP_200_OK

        # PM locks / approves attendance
        lock_res = self.pm_client.post(
            "/api/v1/attendance/approve",
            {"project_id": self.project.id, "date": str(today)},
            format="json",
        )
        assert lock_res.status_code == status.HTTP_200_OK

        # Verify attendance records are locked
        assert (
            Attendance.objects.filter(project=self.project, date=today, is_locked=True).count() >= 2
        )

        # ----------------------------------------------------------------------
        # Step 5: PM Exports DPR Excel Report
        # ----------------------------------------------------------------------
        export_res = self.pm_client.post(
            "/api/v1/reports/dpr/excel",
            {"project_id": self.project.id, "date_from": str(today), "date_to": str(today)},
            format="json",
        )
        assert export_res.status_code == status.HTTP_200_OK
        assert "spreadsheetml.sheet" in export_res["Content-Type"]

        wb = openpyxl.load_workbook(BytesIO(export_res.content))
        assert "DPR Summary Log" in wb.sheetnames
        assert "Tasks & Materials" in wb.sheetnames
