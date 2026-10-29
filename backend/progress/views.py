"""
Daily Progress Reports (DPR) views:
- Timeline listing and creation with tasks and materials
- Photo uploads and deletions
- Verification (with project progress update) and rejection
"""

from attendance.models import Attendance, AttendanceStatus
from core.exceptions import BusinessRuleError
from core.permissions import IsTenantUser, roles_required
from core.roles import Role
from core.views import ProjectScopedMixin, TenantViewSet
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from progress.models import DailyProgressReport, DPRStatus, SitePhoto, WorkEntry
from progress.serializers import (
    DailyProgressReportSerializer,
    RejectDPRSerializer,
    SitePhotoSerializer,
    WorkEntrySerializer,
)
from progress.services import reject_dpr, verify_dpr


class DailyProgressReportViewSet(ProjectScopedMixin, TenantViewSet):
    queryset = DailyProgressReport.objects.all()
    serializer_class = DailyProgressReportSerializer
    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER, Role.SITE_ENGINEER, Role.SUPERVISOR),
    ]
    filterset_fields = ["project", "status", "report_date"]
    search_fields = ["summary", "issues", "project__name"]
    ordering_fields = ["report_date"]
    ordering = ["-report_date"]

    def get_queryset(self):
        qs = super().get_queryset()
        return (
            self.filter_project_scope(qs)
            .select_related("project", "submitted_by", "verified_by")
            .prefetch_related("tasks", "materials", "photos")
        )

    def perform_create(self, serializer):
        if self.request.user.role not in [
            Role.ORG_ADMIN,
            Role.PROJECT_MANAGER,
            Role.SITE_MANAGER,
            Role.SITE_ENGINEER,
            Role.SUPERVISOR,
        ]:
            raise BusinessRuleError(
                "Your role does not have permission to submit site progress reports.",
                code="permission_denied",
            )
        serializer.save(
            organization=self.request.user.organization,
            submitted_by=self.request.user,
        )

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.status == DPRStatus.VERIFIED:
            raise BusinessRuleError("Verified DPRs cannot be modified.", code="report_verified")

        # Only submitter (or PM/ADM) can update
        user = self.request.user
        if instance.submitted_by != user and user.role not in [
            Role.ORG_ADMIN,
            Role.PROJECT_MANAGER,
            Role.SITE_MANAGER,
        ]:
            raise BusinessRuleError("You can only edit your own DPRs.", code="permission_denied")

        serializer.save()

    def perform_destroy(self, instance):
        if instance.status == DPRStatus.VERIFIED:
            raise BusinessRuleError("Verified DPRs cannot be deleted.", code="report_verified")
        user = self.request.user
        if instance.submitted_by != user and user.role not in [
            Role.ORG_ADMIN,
            Role.PROJECT_MANAGER,
            Role.SITE_MANAGER,
        ]:
            raise BusinessRuleError(
                "Only managers or the report submitter can delete unverified DPRs.",
                code="permission_denied",
            )
        super().perform_destroy(instance)

    @action(
        detail=True,
        methods=["post"],
        url_path="verify",
        permission_classes=[roles_required(Role.PROJECT_MANAGER, Role.ORG_ADMIN)],
    )
    def verify(self, request, pk=None):
        """UC-17: PM / ORG_ADMIN verifies DPR and recalculates project progress."""
        dpr = self.get_object()
        verified = verify_dpr(user=request.user, dpr=dpr, request=request)
        return Response(DailyProgressReportSerializer(verified).data, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=["post"],
        url_path="reject",
        permission_classes=[roles_required(Role.PROJECT_MANAGER, Role.ORG_ADMIN)],
    )
    def reject(self, request, pk=None):
        """UC-17: PM / ORG_ADMIN rejects DPR with a mandatory reason."""
        dpr = self.get_object()
        serializer = RejectDPRSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data["reason"]

        rejected = reject_dpr(user=request.user, dpr=dpr, reason=reason, request=request)
        return Response(DailyProgressReportSerializer(rejected).data, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=["post"],
        url_path="photos",
        parser_classes=[MultiPartParser, FormParser],
        permission_classes=[
            IsAuthenticated,
            IsTenantUser,
            roles_required(
                Role.ORG_ADMIN, Role.PROJECT_MANAGER, Role.SITE_ENGINEER, Role.SUPERVISOR
            ),
        ],
    )
    def upload_photo(self, request, pk=None):
        """Upload site photo (up to 10 photos per report, max 5MB)."""
        dpr = self.get_object()
        if dpr.photos.count() >= 10:
            return Response(
                {
                    "error": {
                        "code": "photo_limit_reached",
                        "message": "Maximum 10 photos per DPR reached.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        image_file = request.FILES.get("image")
        if not image_file:
            return Response(
                {"error": {"code": "image_required", "message": "An image file is required."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if image_file.size > 5 * 1024 * 1024:
            return Response(
                {"error": {"code": "file_too_large", "message": "Photo size cannot exceed 5 MB."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        caption = request.data.get("caption", "")
        photo = SitePhoto.objects.create(
            organization=dpr.organization,
            report=dpr,
            image=image_file,
            caption=caption,
        )
        return Response(SitePhotoSerializer(photo).data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["delete"],
        url_path="photos/(?P<photo_id>[^/.]+)",
        permission_classes=[
            IsAuthenticated,
            IsTenantUser,
            roles_required(
                Role.ORG_ADMIN, Role.PROJECT_MANAGER, Role.SITE_ENGINEER, Role.SUPERVISOR
            ),
        ],
    )
    def delete_photo(self, request, pk=None, photo_id=None):
        """Delete site photo from report."""
        dpr = self.get_object()
        try:
            photo = dpr.photos.get(id=photo_id)
        except SitePhoto.DoesNotExist:
            return Response(
                {"error": {"code": "photo_not_found", "message": "Photo not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        photo.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkEntryViewSet(ProjectScopedMixin, TenantViewSet):
    """
    Work Management API:
    - Lists, creates, updates, and deletes daily work entries
    - Fetches present employees from Attendance for given date & project
    - Computes role breakdowns (Karigar, Labour, etc.)
    """

    queryset = WorkEntry.objects.all()
    serializer_class = WorkEntrySerializer
    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER, Role.SITE_ENGINEER, Role.SUPERVISOR),
    ]
    filterset_fields = ["project", "date", "department"]
    search_fields = ["description", "department", "project__name", "project__code"]
    ordering_fields = ["date", "created_at"]
    ordering = ["-date", "-id"]

    def get_queryset(self):
        qs = super().get_queryset()
        qs = (
            self.filter_project_scope(qs)
            .select_related("project", "created_by")
            .prefetch_related("employees")
        )
        date_from = self.request.query_params.get("from_date") or self.request.query_params.get(
            "date_from"
        )
        date_to = self.request.query_params.get("to_date") or self.request.query_params.get(
            "date_to"
        )
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        return qs

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.user.organization,
            created_by=self.request.user,
        )

    @action(detail=False, methods=["get"], url_path="present-employees")
    def present_employees(self, request):
        """
        Fetch all employees who are marked PRESENT or HALF_DAY for a given project and date.
        Returns detailed list and role grouped structure.
        """
        project_id = request.query_params.get("project")
        date_str = request.query_params.get("date")

        if not date_str:
            return Response(
                {"error": {"code": "missing_date", "message": "Date parameter is required."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        org = request.user.organization
        att_qs = (
            Attendance.objects.filter(
                organization=org,
                date=date_str,
                status__in=[AttendanceStatus.PRESENT, AttendanceStatus.HALF_DAY],
                employee__deleted_at__isnull=True,
                employee__is_active=True,
            )
            .select_related("employee", "project", "employee__primary_project")
            .prefetch_related("employee__assigned_projects")
        )

        if project_id and project_id != "all":
            from django.db.models import Q

            try:
                p_id = int(project_id)
                project_specific_qs = att_qs.filter(
                    Q(project_id=p_id)
                    | Q(employee__primary_project_id=p_id)
                    | Q(employee__assigned_projects__id=p_id)
                    | Q(project__isnull=True)
                )
                if project_specific_qs.exists():
                    att_qs = project_specific_qs
            except (ValueError, TypeError):
                pass

        employees = []
        by_role = {}
        seen_ids = set()

        for att in att_qs:
            emp = att.employee
            if emp.id in seen_ids:
                continue
            seen_ids.add(emp.id)

            role_name = emp.role or emp.trade or "Labour"
            proj = att.project or emp.primary_project
            emp_data = {
                "id": emp.id,
                "full_name": emp.full_name,
                "employee_code": emp.employee_code,
                "role": role_name,
                "trade": emp.trade,
                "attendance_status": att.status,
                "project_id": proj.id if proj else None,
                "project_name": proj.name if proj else "",
            }
            employees.append(emp_data)
            by_role.setdefault(role_name, []).append(emp_data)

        return Response(
            {
                "date": date_str,
                "project": project_id,
                "total_present": len(employees),
                "employees": employees,
                "by_role": by_role,
            },
            status=status.HTTP_200_OK,
        )
