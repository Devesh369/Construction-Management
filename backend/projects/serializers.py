from decimal import Decimal

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


class AddMemberSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    site_role = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")


class ProjectSerializer(serializers.ModelSerializer):
    code = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    estimated_budget = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True, default=Decimal("0.00")
    )
    budget_categories = BudgetCategorySerializer(many=True, read_only=True)
    warning = serializers.CharField(read_only=True, required=False)

    def validate_estimated_budget(self, value):
        if value is None or value == "":
            return Decimal("0.00")
        return value

    def validate_client_phone(self, value):
        from core.validators import validate_mobile_10_digits
        if value:
            return validate_mobile_10_digits(value)
        return value

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "code",
            "client_name",
            "client_phone",
            "location",
            "description",
            "status",
            "start_date",
            "expected_end_date",
            "estimated_budget",
            "actual_spend",
            "progress_percent",
            "budget_categories",
            "warning",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "actual_spend",
            "progress_percent",
            "warning",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Check if category allocation matches estimated budget; warn if difference exists
        total_allocated = sum(c.allocated_amount for c in instance.budget_categories.all())
        if (
            instance.estimated_budget > Decimal("0.00")
            and total_allocated != instance.estimated_budget
        ):
            data["warning"] = (
                f"Total category allocation ({total_allocated}) differs from estimated budget ({instance.estimated_budget})."
            )
        return data
