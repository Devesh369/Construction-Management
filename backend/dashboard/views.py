"""
Dashboard executive and project-level KPI views.
"""

from rest_framework import status, views
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.exceptions import NotFoundError
from core.permissions import IsTenantUser, roles_required
from core.roles import Role
from dashboard.services import get_dashboard_overview, get_project_dashboard
from projects.models import Project


class DashboardOverviewView(views.APIView):
    """
    GET /api/v1/dashboard/overview
    Returns executive KPIs and alerts.
    Scoped by tenant organization, and for site-level roles (PM, ENG, SUP) scoped to assigned projects.
    Cached for 60 seconds unless ?refresh=true is provided.
    """

    permission_classes = [IsAuthenticated, IsTenantUser]

    def get(self, request):
        force_refresh = request.query_params.get("refresh", "").lower() in ["true", "1"]
        data = get_dashboard_overview(
            org=request.user.organization,
            user=request.user,
            force_refresh=force_refresh,
        )
        return Response(data, status=status.HTTP_200_OK)


class DashboardProjectDetailView(views.APIView):
    """
    GET /api/v1/dashboard/projects/{id}
    Returns project-level drill-down analytics, budget status, spend breakdown, and recent DPRs.
    Accessible to ORG_ADMIN, PROJECT_MANAGER (assigned), and ACCOUNTANT.
    """

    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER, Role.ACCOUNTANT),
    ]

    def get(self, request, pk=None):
        try:
            project = Project.objects.get(
                organization=request.user.organization, id=pk, deleted_at__isnull=True
            )
        except Project.DoesNotExist:
            raise NotFoundError("Project not found.")

        data = get_project_dashboard(project=project, user=request.user)
        return Response(data, status=status.HTTP_200_OK)
