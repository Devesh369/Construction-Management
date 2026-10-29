from datetime import date
from decimal import Decimal

import pytest
from accounts.services import accept_invitation, create_organization
from audit.constants import AuditAction
from audit.models import AuditLog
from core.exceptions import BusinessRuleError
from projects.services import create_project

from progress.models import DailyProgressReport, DPRStatus, TaskProgress
from progress.services import calculate_project_progress, reject_dpr, verify_dpr


@pytest.mark.django_db
class TestProgressServices:
    def setup_method(self):
        self.org, self.invite, self.token = create_organization("Progress Org", "admin@prog.test")
        self.admin, _ = accept_invitation(self.token, "AdminPass123#", "Admin Prog")
        self.project = create_project(
            self.org, user=self.admin, data={"name": "Progress Site", "code": "PRG-01"}
        )

    def test_calculate_project_progress_average_of_latest_tasks(self):
        """calculate_project_progress takes the latest verified percentage per distinct task and computes simple average."""
        # Report 1 (Day 1, Verified)
        r1 = DailyProgressReport.objects.create(
            organization=self.org,
            project=self.project,
            report_date=date(2026, 3, 1),
            submitted_by=self.admin,
            summary="Day 1",
            status=DPRStatus.VERIFIED,
        )
        TaskProgress.objects.create(
            organization=self.org,
            report=r1,
            task_name="Excavation",
            percent_complete=Decimal("40.00"),
        )
        TaskProgress.objects.create(
            organization=self.org,
            report=r1,
            task_name="Foundation",
            percent_complete=Decimal("20.00"),
        )

        # Report 2 (Day 2, Verified) - Excavation progressed to 100%, Foundation to 60%
        r2 = DailyProgressReport.objects.create(
            organization=self.org,
            project=self.project,
            report_date=date(2026, 3, 2),
            submitted_by=self.admin,
            summary="Day 2",
            status=DPRStatus.VERIFIED,
        )
        TaskProgress.objects.create(
            organization=self.org,
            report=r2,
            task_name="Excavation",
            percent_complete=Decimal("100.00"),
        )
        TaskProgress.objects.create(
            organization=self.org,
            report=r2,
            task_name="Foundation",
            percent_complete=Decimal("60.00"),
        )

        # Report 3 (Day 3, Submitted but NOT verified yet) - should be ignored
        r3 = DailyProgressReport.objects.create(
            organization=self.org,
            project=self.project,
            report_date=date(2026, 3, 3),
            submitted_by=self.admin,
            summary="Day 3 draft",
            status=DPRStatus.SUBMITTED,
        )
        TaskProgress.objects.create(
            organization=self.org,
            report=r3,
            task_name="Foundation",
            percent_complete=Decimal("90.00"),
        )

        # Calculate progress:
        # Latest verified tasks: Excavation=100.00, Foundation=60.00 -> avg = (100 + 60) / 2 = 80.00%
        prog = calculate_project_progress(self.project)
        assert prog == Decimal("80.00")
        self.project.refresh_from_db()
        assert self.project.progress_percent == Decimal("80.00")

    def test_verify_dpr_updates_status_and_audits(self):
        """verify_dpr sets VERIFIED status, recalculates project progress, and logs audit."""
        r = DailyProgressReport.objects.create(
            organization=self.org,
            project=self.project,
            report_date=date(2026, 3, 5),
            submitted_by=self.admin,
            summary="Verification test",
            status=DPRStatus.SUBMITTED,
        )
        TaskProgress.objects.create(
            organization=self.org, report=r, task_name="Masonry", percent_complete=Decimal("50.00")
        )

        verified = verify_dpr(user=self.admin, dpr=r)
        assert verified.status == DPRStatus.VERIFIED
        assert verified.verified_by == self.admin
        assert verified.verified_at is not None
        assert self.project.progress_percent == Decimal("50.00")

        # Verify audit log
        audit = AuditLog.objects.filter(
            organization=self.org, action=AuditAction.DPR_VERIFIED
        ).first()
        assert audit is not None
        assert audit.resource_id == str(r.id)

    def test_reject_dpr_requires_reason_and_audits(self):
        """reject_dpr requires reason, updates status to REJECTED, and logs audit."""
        r = DailyProgressReport.objects.create(
            organization=self.org,
            project=self.project,
            report_date=date(2026, 3, 6),
            submitted_by=self.admin,
            summary="Rejection test",
            status=DPRStatus.SUBMITTED,
        )

        with pytest.raises(BusinessRuleError, match="reason is mandatory"):
            reject_dpr(user=self.admin, dpr=r, reason="")

        rejected = reject_dpr(user=self.admin, dpr=r, reason="Incomplete photographic proof")
        assert rejected.status == DPRStatus.REJECTED
        assert rejected.rejection_reason == "Incomplete photographic proof"

        audit = AuditLog.objects.filter(
            organization=self.org, action=AuditAction.DPR_REJECTED
        ).first()
        assert audit is not None
