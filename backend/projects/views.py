"""
Projects and members ViewSet.
Enforces tenant isolation and membership scoping.
"""

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsTenantUser, roles_required
from core.roles import Role
from core.views import ProjectScopedMixin, TenantViewSet
from projects.models import BudgetCategory, Project, ProjectMembership
from projects.serializers import (
    AddMemberSerializer,
    BudgetCategorySerializer,
    ProjectMembershipSerializer,
    ProjectSerializer,
)
from projects.services import archive_project, create_project, update_project


class ProjectViewSet(ProjectScopedMixin, TenantViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, IsTenantUser]
    filterset_fields = ["status"]
    search_fields = ["name", "code", "client_name"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Project.objects.none()
        qs = super().get_queryset()
        return self.filter_project_scope(qs).prefetch_related("budget_categories")

    def create(self, request, *args, **kwargs):
        # Create project is permitted for ORG_ADMIN and PROJECT_MANAGER
        if request.user.role not in [Role.ORG_ADMIN, Role.PROJECT_MANAGER]:
            return Response(
                {
                    "error": {
                        "code": "permission_denied",
                        "message": "Only ORG_ADMIN and PROJECT_MANAGER can create projects.",
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        project = create_project(
            org=request.user.organization,
            user=request.user,
            data=serializer.validated_data,
            request=request,
        )
        return Response(ProjectSerializer(project).data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        update_project(
            project=self.get_object(),
            data=serializer.validated_data,
            user=self.request.user,
            request=self.request,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="archive",
        permission_classes=[roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER)],
    )
    def archive(self, request, pk=None):
        project = self.get_object()
        archived = archive_project(project, user=request.user, request=request)
        return Response(
            {"status": archived.status, "message": f"Project '{project.name}' archived."}
        )

    @action(
        detail=True,
        methods=["get"],
        url_path="analytics",
        permission_classes=[roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER, Role.ACCOUNTANT)],
    )
    def analytics(self, request, pk=None):
        project = self.get_object()
        remaining = project.estimated_budget - project.actual_spend
        utilization = 0.0
        if project.estimated_budget > 0:
            utilization = round(float((project.actual_spend / project.estimated_budget) * 100), 2)

        budget_status = "OK"
        if utilization >= 100:
            budget_status = "OVER_BUDGET"
        elif utilization >= 90:
            budget_status = "WARNING"

        categories_data = [
            {"name": c.name, "allocated_amount": str(c.allocated_amount)}
            for c in project.budget_categories.all()
        ]

        return Response(
            {
                "project_id": project.id,
                "name": project.name,
                "budget": str(project.estimated_budget),
                "actual_spend": str(project.actual_spend),
                "remaining": str(remaining),
                "utilization_percent": str(utilization),
                "budget_status": budget_status,
                "progress_percent": str(project.progress_percent),
                "category_allocations": categories_data,
            }
        )

    @action(detail=True, methods=["get", "post"], url_path="members")
    def members(self, request, pk=None):
        project = self.get_object()
        if request.method == "GET":
            memberships = project.memberships.select_related("user")
            serializer = ProjectMembershipSerializer(memberships, many=True)
            return Response(serializer.data)

        # POST: Add user to project team
        if request.user.role not in [Role.ORG_ADMIN, Role.PROJECT_MANAGER]:
            return Response(
                {
                    "error": {
                        "code": "permission_denied",
                        "message": "Only managers can add members.",
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AddMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_id = serializer.validated_data["user_id"]
        site_role = serializer.validated_data.get("site_role", "")

        membership, created = ProjectMembership.objects.get_or_create(
            organization=request.user.organization,
            project=project,
            user_id=user_id,
            defaults={"site_role": site_role},
        )
        if not created and site_role:
            membership.site_role = site_role
            membership.save(update_fields=["site_role"])

        return Response(
            ProjectMembershipSerializer(membership).data, status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["delete"], url_path="members/(?P<user_id>[^/.]+)")
    def remove_member(self, request, pk=None, user_id=None):
        if request.user.role not in [Role.ORG_ADMIN, Role.PROJECT_MANAGER]:
            return Response(
                {
                    "error": {
                        "code": "permission_denied",
                        "message": "Only managers can remove members.",
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        project = self.get_object()
        ProjectMembership.objects.filter(project=project, user_id=user_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get", "patch"], url_path="budget-categories")
    def budget_categories(self, request, pk=None):
        project = self.get_object()
        if request.method == "GET":
            cats = project.budget_categories.all()
            return Response(BudgetCategorySerializer(cats, many=True).data)

        # PATCH: update category allocations
        if request.user.role not in [Role.ORG_ADMIN, Role.PROJECT_MANAGER]:
            return Response(
                {
                    "error": {
                        "code": "permission_denied",
                        "message": "Only managers can update budget categories.",
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        categories_data = request.data if isinstance(request.data, list) else [request.data]
        updated = []
        for item in categories_data:
            cat_id = item.get("id")
            amount = item.get("allocated_amount")
            if cat_id and amount is not None:
                cat = project.budget_categories.filter(id=cat_id).first()
                if cat:
                    cat.allocated_amount = amount
                    cat.save(update_fields=["allocated_amount"])
                    updated.append(cat)

        return Response(BudgetCategorySerializer(updated, many=True).data)


class BudgetCategoryViewSet(TenantViewSet):
    queryset = BudgetCategory.objects.all()
    serializer_class = BudgetCategorySerializer
    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ORG_ADMIN, Role.PROJECT_MANAGER),
    ]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return BudgetCategory.objects.none()
        return BudgetCategory.objects.filter(organization=self.request.user.organization)
