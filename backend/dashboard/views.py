"""
Dashboard analytics views.
"""

from rest_framework import status, views
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsTenantUser, roles_required
from core.roles import Role
from projects.models import Project
from workforce.models import Employee


class DashboardOverviewView(views.APIView):
    permission_classes = [IsAuthenticated, IsTenantUser]

    def get(self, request):
        org = request.user.organization
        active_projects_count = Project.objects.filter(organization=org, status="ACTIVE").count()
        active_workers_count = Employee.objects.filter(organization=org, is_active=True).count()

        return Response(
            {
                "active_projects": active_projects_count,
                "active_workers": active_workers_count,
                "workers_on_site_today": 0,
                "month_expenditure": "0.00",
                "total_budget": "0.00",
                "total_spend": "0.00",
                "budget_utilization_percent": "0.00",
                "burn_rate_daily": "0.00",
                "pending_approvals": {
                    "expenses": 0,
                    "dpr": 0,
                    "attendance_days_unlocked": 0,
                    "payroll_runs": 0,
                },
                "spend_by_category": [],
                "attendance_trend": [],
                "alerts": [],
                "projects": [],
            }
        )


class DashboardProjectDetailView(views.APIView):
    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER, Role.ACCOUNTANT),
    ]

    def get(self, request, pk=None):
        try:
            project = Project.objects.get(organization=request.user.organization, id=pk)
        except Project.DoesNotExist:
            return Response(
                {"error": {"code": "not_found", "message": "Project not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {
                "project_id": project.id,
                "name": project.name,
                "budget": str(project.estimated_budget),
                "actual_spend": str(project.actual_spend),
                "progress_percent": str(project.progress_percent),
                "spend_by_category": [],
                "latest_dprs": [],
            }
        )
