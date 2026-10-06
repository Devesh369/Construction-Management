from rest_framework import serializers

from projects.models import BudgetCategory, Project, ProjectMembership


class BudgetCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = BudgetCategory
        fields = ["id", "name", "allocated_amount"]


class ProjectMembershipSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.name", read_only=True)

    class Meta:
        model = ProjectMembership
        fields = ["id", "project", "user", "user_email", "user_name", "site_role"]
        read_only_fields = ["id", "project"]


class ProjectSerializer(serializers.ModelSerializer):
    budget_categories = BudgetCategorySerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "code",
            "client_name",
            "location",
            "status",
            "start_date",
            "expected_end_date",
            "estimated_budget",
            "actual_spend",
            "progress_percent",
            "geofence_lat",
            "geofence_lng",
            "geofence_radius_m",
            "budget_categories",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "actual_spend", "progress_percent", "created_at", "updated_at"]
