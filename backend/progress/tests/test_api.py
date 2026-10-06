import io
from datetime import date, timedelta
from decimal import Decimal

import pytest
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from accounts.services import accept_invitation, create_organization, create_user_invitation
from core.roles import Role
from progress.models import DailyProgressReport, DPRStatus
from projects.services import add_project_member, create_project


def _create_test_image():
    """Generate in-memory RGB JPEG image for test upload."""
    file_io = io.BytesIO()
    image = Image.new("RGB", (100, 100), color="blue")
    image.save(file_io, format="JPEG")
    file_io.seek(0)
    file_io.name = "site_photo.jpg"
    return file_io


@pytest.mark.django_db
class TestProgressAPI:
    def setup_method(self):
        self.client = APIClient()

        # Tenant Alpha
        self.org_alpha, _, tok_adm_a = create_organization("Alpha Infra", "admin@alphainfra.test")
        self.admin_alpha, self.toks_admin_a = accept_invitation(
            tok_adm_a, "AlphaAdmin123#", "Admin Alpha"
        )

        # PM in Alpha
        _, tok_pm_a = create_user_invitation(
            self.org_alpha,
            "pm@alphainfra.test",
            Role.PROJECT_MANAGER,
            self.admin_alpha,
            name="PM Alpha",
        )
        self.pm_alpha, self.toks_pm_a = accept_invitation(tok_pm_a, "AlphaPm123#", "PM Alpha")

        # Supervisor in Alpha
        _, tok_sup_a = create_user_invitation(
            self.org_alpha,
            "sup@alphainfra.test",
            Role.SUPERVISOR,
            self.admin_alpha,
            name="Supervisor Alpha",
        )
        self.sup_alpha, self.toks_sup_a = accept_invitation(
            tok_sup_a, "AlphaSup123#", "Supervisor Alpha"
        )

        # Project
        self.project_alpha = create_project(
            self.org_alpha,
            user=self.admin_alpha,
            data={"name": "Skyline Project", "code": "SKY-01"},
        )
        add_project_member(self.project_alpha, self.pm_alpha, site_role="Project Manager")
        add_project_member(self.project_alpha, self.sup_alpha, site_role="Site Supervisor")

    def test_uc16_submit_dpr_api(self):
        """UC-16: Supervisor submits DPR with tasks and material usage."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_sup_a['access']}")
        today_str = str(date.today())

        payload = {
            "project": self.project_alpha.id,
            "report_date": today_str,
            "weather": "Sunny, 32C",
            "summary": "Completed foundation excavation and steel reinforcement.",
            "issues": "Delay in cement delivery by 1 hour.",
            "tasks": [
                {
                    "task_name": "Excavation",
                    "percent_complete": "100.00",
                    "notes": "Completed zone A",
                },
                {"task_name": "Steel Binding", "percent_complete": "45.00", "notes": "In progress"},
            ],
            "materials": [
                {"material_name": "TMT Steel 16mm", "quantity": "2.500", "unit": "TONS"},
            ],
        }

        res = self.client.post("/api/v1/dpr", payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["status"] == "SUBMITTED"
        assert len(res.data["tasks"]) == 2
        assert len(res.data["materials"]) == 1

    def test_submit_dpr_future_date_rejected(self):
        """DPR date in the future is rejected."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_sup_a['access']}")
        future_date = str(date.today() + timedelta(days=2))

        payload = {
            "project": self.project_alpha.id,
            "report_date": future_date,
            "summary": "Future progress",
            "tasks": [{"task_name": "Task 1", "percent_complete": "50.00"}],
        }
        res = self.client.post("/api/v1/dpr", payload, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "future" in str(res.data)

    def test_submit_dpr_without_tasks_rejected(self):
        """DPR without any task entries is rejected."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_sup_a['access']}")
        payload = {
            "project": self.project_alpha.id,
            "report_date": str(date.today()),
            "summary": "No tasks report",
            "tasks": [],
        }
        res = self.client.post("/api/v1/dpr", payload, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "task entry is required" in str(res.data)

    def test_uc17_verify_and_reject_dpr_api(self):
        """UC-17: PM verifies or rejects DPR; verified updates project progress percent."""
        # 1. Supervisor submits DPR
        dpr = DailyProgressReport.objects.create(
            organization=self.org_alpha,
            project=self.project_alpha,
            report_date=date.today(),
            submitted_by=self.sup_alpha,
            summary="Ready for review",
            status=DPRStatus.SUBMITTED,
        )
        dpr.tasks.create(
            organization=self.org_alpha, task_name="Plastering", percent_complete=Decimal("60.00")
        )

        # 2. PM rejects DPR first
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_pm_a['access']}")
        res_rej = self.client.post(
            f"/api/v1/dpr/{dpr.id}/reject",
            {"reason": "Quality check failed on wall B"},
            format="json",
        )
        assert res_rej.status_code == status.HTTP_200_OK
        assert res_rej.data["status"] == "REJECTED"

        # 3. Submitter edits rejected DPR -> resets to SUBMITTED
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_sup_a['access']}")
        res_edit = self.client.patch(
            f"/api/v1/dpr/{dpr.id}", {"summary": "Corrected quality flaws"}, format="json"
        )
        assert res_edit.status_code == status.HTTP_200_OK
        assert res_edit.data["status"] == "SUBMITTED"

        # 4. PM verifies DPR -> updates project progress
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_pm_a['access']}")
        res_ver = self.client.post(f"/api/v1/dpr/{dpr.id}/verify")
        assert res_ver.status_code == status.HTTP_200_OK
        assert res_ver.data["status"] == "VERIFIED"
        self.project_alpha.refresh_from_db()
        assert self.project_alpha.progress_percent == Decimal("60.00")

    def test_dpr_photo_upload_and_delete_api(self):
        """Supervisor uploads site photo and deletes photo."""
        dpr = DailyProgressReport.objects.create(
            organization=self.org_alpha,
            project=self.project_alpha,
            report_date=date.today(),
            submitted_by=self.sup_alpha,
            summary="Photo test",
            status=DPRStatus.SUBMITTED,
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_sup_a['access']}")
        img = _create_test_image()

        res_upload = self.client.post(
            f"/api/v1/dpr/{dpr.id}/photos",
            {"image": img, "caption": "Foundation slab complete"},
            format="multipart",
        )
        assert res_upload.status_code == status.HTTP_201_CREATED
        photo_id = res_upload.data["id"]

        # Delete photo
        res_del = self.client.delete(f"/api/v1/dpr/{dpr.id}/photos/{photo_id}")
        assert res_del.status_code == status.HTTP_204_NO_CONTENT
        assert dpr.photos.count() == 0
