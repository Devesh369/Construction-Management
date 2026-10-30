"""
Views for Running Costs Module (Site Expenses).
Directly implements Section 3.3, 3.4, and 3.5 of Module Architecture & Workflow Specification.
"""

from core.permissions import IsTenantUser
from core.roles import Role
from core.views import TenantViewSet
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from expenses.models import RunningCost
from expenses.serializers_running_costs import RunningCostSerializer
from expenses.services_running_costs import RunningCostService


class RunningCostViewSet(TenantViewSet):
    """
    Running Costs Module: Non-salary site operational costs (materials, fuel, food, equipment).
    """

    queryset = RunningCost.objects.all().select_related("project", "entered_by")
    serializer_class = RunningCostSerializer
    permission_classes = [IsAuthenticated, IsTenantUser]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        # Admins see only their own entries unless ORG_ADMIN or ACCOUNTANT (Section 3.4 B)
        if user.role != Role.ORG_ADMIN:
            qs = qs.filter(entered_by=user)

        project_id = self.request.query_params.get("project")
        from_date = self.request.query_params.get("fromDate") or self.request.query_params.get(
            "from_date"
        )
        to_date = self.request.query_params.get("toDate") or self.request.query_params.get(
            "to_date"
        )
        search = self.request.query_params.get("search")

        if project_id:
            qs = qs.filter(project_id=project_id)
        if from_date:
            qs = qs.filter(date__gte=from_date)
        if to_date:
            qs = qs.filter(date__lte=to_date)
        if search:
            qs = qs.filter(description__icontains=search) | qs.filter(
                project__name__icontains=search
            )

        return qs

    def create(self, request, *args, **kwargs):
        """Create a new running cost entry (gated by cash credit balance if cash)."""
        rc = RunningCostService.create_running_cost(
            data=request.data,
            user=request.user,
            organization=request.user.organization,
        )
        serializer = self.get_serializer(rc)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Aggregated summary of running costs (Section 3.4 B)."""
        project_id = request.query_params.get("project")
        data = RunningCostService.get_summary(
            organization=request.user.organization,
            project_id=project_id,
            user=request.user,
        )
        return Response(data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """Delete running cost with credit restoration if paid in cash."""
        res = RunningCostService.delete_running_cost(
            running_cost_id=kwargs.get("pk"),
            user=request.user,
            organization=request.user.organization,
        )
        return Response(res, status=status.HTTP_200_OK)
