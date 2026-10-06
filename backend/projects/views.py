"""
Projects views and endpoints.
"""

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsTenantUser, roles_required
from core.roles import Role
from core.views import ProjectScopedMixin, TenantViewSet
from projects.models import Project, ProjectMembership
from projects.serializers import (
    ProjectMembershipSerializer,
    ProjectSerializer,
)
from projects.services import create_project


class ProjectViewSet(ProjectScopedMixin, TenantViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, IsTenantUser]

    def get_queryset(self):
        qs = super().get_queryset()
        return self.filter_project_scope(qs)

    def perform_create(self, serializer):
        create_project(
            org=self.request.user.organization,
            user=self.request.user,
            data=serializer.validated_data,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="archive",
        permission_classes=[roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER)],
    )
    def archive(self, request, pk=None):
        project = self.get_object()
        project.status = "ARCHIVED"
        project.save(update_fields=["status", "updated_at"])
        return Response({"status": "ARCHIVED"})

    @action(detail=True, methods=["get"], url_path="analytics")
    def analytics(self, request, pk=None):
        project = self.get_object()
        remaining = project.estimated_budget - project.actual_spend
        utilization = 0
        if project.estimated_budget > 0:
            utilization = round((project.actual_spend / project.estimated_budget) * 100, 2)

        budget_status = "OK"
        if utilization >= 100:
            budget_status = "OVER_BUDGET"
        elif utilization >= 90:
            budget_status = "WARNING"

        return Response(
            {
                "project_id": project.id,
                "budget": str(project.estimated_budget),
                "actual_spend": str(project.actual_spend),
                "remaining": str(remaining),
                "utilization_percent": str(utilization),
                "budget_status": budget_status,
                "progress_percent": str(project.progress_percent),
            }
        )

    @action(detail=True, methods=["get", "post"], url_path="members")
    def members(self, request, pk=None):
        project = self.get_object()
        if request.method == "GET":
            memberships = project.memberships.select_related("user")
            serializer = ProjectMembershipSerializer(memberships, many=True)
            return Response(serializer.data)

        # POST: Add member
        user_id = request.data.get("user_id")
        site_role = request.data.get("site_role", "")
        membership, _ = ProjectMembership.objects.get_or_create(
            organization=request.user.organization,
            project=project,
            user_id=user_id,
            defaults={"site_role": site_role},
        )
        return Response(
            ProjectMembershipSerializer(membership).data, status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["delete"], url_path="members/(?P<user_id>[^/.]+)")
    def remove_member(self, request, pk=None, user_id=None):
        project = self.get_object()
        ProjectMembership.objects.filter(project=project, user_id=user_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
