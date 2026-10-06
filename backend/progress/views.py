"""
Daily Progress Reports (DPR) views:
- Timeline listing and creation with tasks and materials
- Photo uploads and deletions
- Verification (with project progress update) and rejection
"""

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.exceptions import BusinessRuleError
from core.permissions import IsTenantUser, roles_required
from core.roles import Role
from core.views import ProjectScopedMixin, TenantViewSet
from progress.models import DailyProgressReport, DPRStatus, SitePhoto
from progress.serializers import (
    DailyProgressReportSerializer,
    RejectDPRSerializer,
    SitePhotoSerializer,
)
from progress.services import reject_dpr, verify_dpr


class DailyProgressReportViewSet(ProjectScopedMixin, TenantViewSet):
    queryset = DailyProgressReport.objects.all()
    serializer_class = DailyProgressReportSerializer
    permission_classes = [IsAuthenticated, IsTenantUser]
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

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.status == DPRStatus.VERIFIED:
            raise BusinessRuleError("Verified DPRs cannot be modified.", code="report_verified")

        # Only submitter (or PM/ADM) can update
        user = self.request.user
        if instance.submitted_by != user and user.role not in [
            Role.ORG_ADMIN,
            Role.PROJECT_MANAGER,
        ]:
            raise BusinessRuleError("You can only edit your own DPRs.", code="permission_denied")

        serializer.save()

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
        permission_classes=[IsAuthenticated, IsTenantUser],
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
        permission_classes=[IsAuthenticated, IsTenantUser],
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
