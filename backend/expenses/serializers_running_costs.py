"""
Serializers for Running Costs Module.
"""

from rest_framework import serializers
from expenses.models import RunningCost


class RunningCostSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)
    project_code = serializers.CharField(source="project.code", read_only=True)
    entered_by_name = serializers.CharField(source="entered_by.get_full_name", read_only=True)
    entered_by_email = serializers.CharField(source="entered_by.email", read_only=True)

    class Meta:
        model = RunningCost
        fields = [
            "id",
            "project",
            "project_name",
            "project_code",
            "date",
            "amount",
            "description",
            "entered_by",
            "entered_by_name",
            "entered_by_email",
            "user_name",
            "user_role",
            "payment_method",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "entered_by",
            "user_name",
            "user_role",
            "created_at",
            "updated_at",
        ]
