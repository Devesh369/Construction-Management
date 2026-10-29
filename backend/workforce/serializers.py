from decimal import Decimal

from core.roles import Role
from projects.models import Project
from rest_framework import serializers

from workforce.models import Employee, LaborGroup
from workforce.services import get_employee_financials


class LaborGroupSerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=100, required=True, allow_blank=False)
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all(), required=True)
    leader_name = serializers.CharField(source="leader.full_name", read_only=True)
    member_count = serializers.IntegerField(source="members.count", read_only=True)

    class Meta:
        model = LaborGroup
        fields = ["id", "name", "project", "leader", "leader_name", "is_active", "member_count"]
        read_only_fields = ["id"]


class EmployeeSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(max_length=150, required=True, allow_blank=False)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    employee_code = serializers.CharField(required=False, allow_blank=True, default="")
    effective_daily_rate = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    role = serializers.CharField(required=False, allow_blank=True, default="Karigar")
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    address = serializers.CharField(required=False, allow_blank=True, default="")
    emergency_contact = serializers.CharField(required=False, allow_blank=True, default="")
    bank_name = serializers.CharField(required=False, allow_blank=True, default="")
    daily_rate = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0.00"),
        required=False,
        default=Decimal("800.00"),
    )
    ot_hourly_rate = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0.00"),
        required=False,
        default=Decimal("0.00"),
    )
    monthly_salary = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0.00"),
        required=False,
        default=Decimal("0.00"),
    )
    primary_project_name = serializers.CharField(source="primary_project.name", read_only=True)
    trade = serializers.CharField(required=False, default="HELPER")

    def validate_trade(self, value):
        from workforce.models import Trade

        if not value:
            return Trade.OTHER
        val_upper = str(value).upper().strip()
        if val_upper in Trade.values:
            return val_upper
        if val_upper in ["LABOUR", "LABOR", "MAZDOOR", "COOLIE"]:
            return Trade.LABOUR
        if val_upper in ["KARIGAR", "ARTISAN", "WORKER", "CRAFTSMAN"]:
            return Trade.KARIGAR
        return Trade.OTHER

    def validate_phone(self, value):
        from core.validators import validate_mobile_10_digits

        return validate_mobile_10_digits(value)

    def validate_emergency_contact(self, value):
        from core.validators import validate_mobile_10_digits

        if value:
            return validate_mobile_10_digits(value)
        return value

    class Meta:
        model = Employee
        fields = [
            "id",
            "employee_code",
            "full_name",
            "phone",
            "email",
            "role",
            "address",
            "emergency_contact",
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
            "primary_project_name",
            "assigned_projects",
            "group",
            # Sensitive / Bank fields:
            "bank_account_name",
            "bank_account_number",
            "bank_ifsc",
            "bank_name",
            "upi_id",
            "id_proof_type",
            "id_proof_number",
        ]
        read_only_fields = ["id", "effective_daily_rate", "primary_project_name"]

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

        # Attach real-time financial breakdown (total_pagar, total_upad, total_paid, balance)
        try:
            financials = get_employee_financials(instance)
            data["financials"] = financials
            data["balance"] = financials["balance"]
        except Exception:
            data["financials"] = {
                "total_pagar": "0.00",
                "total_upad": "0.00",
                "total_paid": "0.00",
                "balance": "0.00",
            }
            data["balance"] = "0.00"

        # Assigned projects telemetry
        data["assigned_projects_details"] = [
            {
                "id": p.id,
                "name": p.name,
                "code": p.code,
                "status": p.status,
                "location": p.location,
            }
            for p in instance.assigned_projects.all()
        ]
        if instance.primary_project:
            data["primary_project_name"] = instance.primary_project.name
            data["primary_project_code"] = instance.primary_project.code

        if instance.group:
            data["group_name"] = instance.group.name

        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            # Sensitive worker fields hidden from SUP and ENG
            if request.user.role in [Role.SUPERVISOR, Role.SITE_ENGINEER]:
                sensitive_fields = [
                    "bank_account_name",
                    "bank_account_number",
                    "bank_ifsc",
                    "bank_name",
                    "upi_id",
                    "id_proof_number",
                ]
                for f in sensitive_fields:
                    data.pop(f, None)
        return data
