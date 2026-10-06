from datetime import date
from decimal import Decimal

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.services import accept_invitation, create_organization, create_user_invitation
from attendance.models import Attendance, AttendanceStatus
from core.roles import Role
from projects.services import add_project_member, create_project
from workforce.services import create_employee, create_labor_group


@pytest.mark.django_db
class TestAttendanceAPI:
    def setup_method(self):
        self.client = APIClient()

        # Tenant Alpha
        self.org_alpha, _, tok_adm_a = create_organization("Alpha Builders", "admin@alpha.test")
        self.admin_alpha, self.toks_admin_a = accept_invitation(
            tok_adm_a, "AlphaAdmin123#", "Admin Alpha"
        )

        # PM in Alpha
        _, tok_pm_a = create_user_invitation(
            self.org_alpha, "pm@alpha.test", Role.PROJECT_MANAGER, self.admin_alpha, name="PM Alpha"
        )
        self.pm_alpha, self.toks_pm_a = accept_invitation(tok_pm_a, "AlphaPm123#", "PM Alpha")

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

        # Project with GPS geofence (200m radius)
        self.project_alpha = create_project(
            self.org_alpha,
            user=self.admin_alpha,
            data={
                "name": "Tower Alpha",
                "code": "TWR-01",
                "geofence_lat": Decimal("19.076000"),
                "geofence_lng": Decimal("72.877700"),
                "geofence_radius_m": 200,
            },
        )
        add_project_member(self.project_alpha, self.pm_alpha, site_role="Project Manager")
        add_project_member(self.project_alpha, self.sup_alpha, site_role="Site Supervisor")

        # Workers
        self.worker1 = create_employee(
            self.org_alpha,
            data={
                "full_name": "Kishore Kumar",
                "trade": "MASON",
                "employment_type": "DAILY_WAGE",
                "daily_rate": Decimal("800.00"),
                "primary_project": self.project_alpha,
            },
            user=self.admin_alpha,
        )

    def test_uc11_worker_check_in_api_inside_geofence(self):
        """UC-11: Supervisor checks in worker within project geofence."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_sup_a['access']}")
        data = {
            "employee_id": self.worker1.id,
            "project_id": self.project_alpha.id,
            "latitude": 19.076100,  # ~11 meters away
            "longitude": 72.877700,
            "shift_type": "DAY",
        }
        res = self.client.post("/api/v1/attendance/check-in", data, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["is_geofence_verified"] is True
        assert res.data["status"] == "PRESENT"

    def test_uc11_worker_check_in_api_outside_geofence(self):
        """UC-11: Check-in outside geofence boundary is rejected with 422."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_sup_a['access']}")
        data = {
            "employee_id": self.worker1.id,
            "project_id": self.project_alpha.id,
            "latitude": 19.085000,  # ~1 km away
            "longitude": 72.877700,
            "shift_type": "DAY",
        }
        res = self.client.post("/api/v1/attendance/check-in", data, format="json")
        assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert "Outside project geofence boundary" in str(res.data)

    def test_uc12_batch_marking_gang_api(self):
        """UC-12: Supervisor batch-marks attendance for a labor gang."""
        group = create_labor_group(self.org_alpha, self.project_alpha, name="Mason Gang")
        self.worker1.group = group
        self.worker1.save(update_fields=["group"])

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_sup_a['access']}")
        payload = {
            "project_id": self.project_alpha.id,
            "date": "2026-03-25",
            "shift_type": "DAY",
            "group_id": group.id,
            "group_status": "PRESENT",
        }
        res = self.client.post("/api/v1/attendance/batch", payload, format="json")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["created"] == 1

    def test_uc13_configure_holidays_api(self):
        """UC-13: Admin configures org and site holidays; GET returns both."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_admin_a['access']}")

        # 1. Create org-wide holiday
        res_org = self.client.post(
            "/api/v1/holidays",
            {
                "name": "Republic Day",
                "date": "2026-01-26",
                "is_paid": True,
                "holiday_type": "NATIONAL",
            },
            format="json",
        )
        assert res_org.status_code == status.HTTP_201_CREATED

        # 2. Create site-specific holiday
        res_site = self.client.post(
            "/api/v1/holidays",
            {
                "project": self.project_alpha.id,
                "name": "Local Monsoon Closure",
                "date": "2026-07-15",
                "is_paid": False,
                "holiday_type": "WEATHER",
            },
            format="json",
        )
        assert res_site.status_code == status.HTTP_201_CREATED

        # 3. Query with ?project= -> returns both
        res_list = self.client.get(f"/api/v1/holidays?project={self.project_alpha.id}")
        assert res_list.status_code == status.HTTP_200_OK
        names = [h["name"] for h in res_list.data.get("results", res_list.data)]
        assert "Republic Day" in names
        assert "Local Monsoon Closure" in names

    def test_uc14_run_night_shift_api(self):
        """UC-14: Supervisor starts and completes night shift with safety checklist."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_sup_a['access']}")
        payload = {
            "project_id": self.project_alpha.id,
            "shift_date": "2026-03-28",
            "employee_ids": [self.worker1.id],
            "safety_checklist_signed": True,
            "checklist_notes": "All safety harnesses and floodlights inspected.",
        }
        res = self.client.post("/api/v1/night-shifts", payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        session_id = res.data["id"]

        # Complete session
        res_comp = self.client.patch(
            f"/api/v1/night-shifts/{session_id}/complete",
            {"work_completed": "Excavation completed"},
            format="json",
        )
        assert res_comp.status_code == status.HTTP_200_OK
        assert res_comp.data["status"] == "COMPLETED"

        # PM approves session -> locks attendance rows
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_pm_a['access']}")
        res_appr = self.client.post(f"/api/v1/night-shifts/{session_id}/approve")
        assert res_appr.status_code == status.HTTP_200_OK
        assert res_appr.data["status"] == "APPROVED"

    def test_uc15_approve_and_unlock_attendance_api(self):
        """UC-15: PM approves attendance, locking rows; Admin unlocks with reason."""
        # Mark attendance first
        Attendance.objects.create(
            organization=self.org_alpha,
            employee=self.worker1,
            project=self.project_alpha,
            date=date(2026, 3, 29),
            shift_type="DAY",
            status=AttendanceStatus.PRESENT,
            marked_by=self.sup_alpha,
        )

        # PM locks attendance
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_pm_a['access']}")
        res_lock = self.client.post(
            "/api/v1/attendance/approve",
            {"project_id": self.project_alpha.id, "date": "2026-03-29"},
            format="json",
        )
        assert res_lock.status_code == status.HTTP_200_OK
        assert res_lock.data["locked_count"] == 1

        # Trying to edit locked row -> 409
        rec = Attendance.objects.get(project=self.project_alpha, date=date(2026, 3, 29))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_sup_a['access']}")
        res_patch = self.client.patch(
            f"/api/v1/attendance/{rec.id}", {"remarks": "Modified"}, format="json"
        )
        assert res_patch.status_code == status.HTTP_409_CONFLICT

        # Admin unlocks with reason
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_admin_a['access']}")
        res_unlock = self.client.post(
            "/api/v1/attendance/unlock",
            {
                "project_id": self.project_alpha.id,
                "date": "2026-03-29",
                "reason": "Correct supervisor oversight",
            },
            format="json",
        )
        assert res_unlock.status_code == status.HTTP_200_OK
        assert res_unlock.data["unlocked_count"] == 1

    def test_attendance_matrix_endpoint(self):
        """Attendance matrix returns employee rows and date columns."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.toks_sup_a['access']}")
        res = self.client.get(
            f"/api/v1/attendance/matrix?project={self.project_alpha.id}&date_from=2026-03-01&date_to=2026-03-31"
        )
        assert res.status_code == status.HTTP_200_OK
        assert "rows" in res.data
        assert "records" in res.data
