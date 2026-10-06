from rest_framework import serializers

from core.roles import Role
from workforce.models import Employee, LaborGroup


class LaborGroupSerializer(serializers.ModelSerializer):
    leader_name = serializers.CharField(source="leader.full_name", read_only=True)
    member_count = serializers.IntegerField(source="members.count", read_only=True)

    class Meta:
        model = LaborGroup
        fields = ["id", "name", "project", "leader", "leader_name", "is_active", "member_count"]
        read_only_fields = ["id"]


class EmployeeSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(required=False, allow_blank=True, default="")
    effective_daily_rate = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Employee
        fields = [
            "id",
            "employee_code",
            "full_name",
            "phone",
            "joining_date",
            "is_active",
            "trade",
            "skill_level",
            "employment_type",
            "daily_rate",
            "ot_hourly_rate",
            "monthly_salary",
            "effective_daily_rate",
            "primary_project",
            "group",
            # Sensitive fields:
            "bank_account_name",
            "bank_account_number",
            "bank_ifsc",
            "upi_id",
            "id_proof_type",
            "id_proof_number",
        ]
        read_only_fields = ["id", "effective_daily_rate"]

    def validate_primary_project(self, value):
        request = self.context.get("request")
        if value and request and request.user and request.user.is_authenticated:
            if value.organization_id != request.user.organization_id:
                raise serializers.ValidationError("Project does not exist.")
        return value

    def validate_group(self, value):
        request = self.context.get("request")
        if value and request and request.user and request.user.is_authenticated:
            if value.organization_id != request.user.organization_id:
                raise serializers.ValidationError("Labor group does not exist.")
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            # Sensitive worker fields hidden from SUP and ENG
            if request.user.role in [Role.SUPERVISOR, Role.SITE_ENGINEER]:
                sensitive_fields = [
                    "bank_account_name",
                    "bank_account_number",
                    "bank_ifsc",
                    "upi_id",
                    "id_proof_number",
                ]
                for f in sensitive_fields:
                    data.pop(f, None)
        return data
