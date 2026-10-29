from decimal import Decimal

from rest_framework import serializers

from payroll.models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01"), required=True
    )
    description = serializers.CharField(required=True, allow_blank=False)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_trade = serializers.CharField(source="employee.trade", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True, default=None)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    created_by_email = serializers.CharField(source="created_by.email", read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "employee",
            "employee_name",
            "employee_code",
            "employee_trade",
            "project",
            "project_name",
            "type",
            "base_salary",
            "expenses",
            "amount",
            "method",
            "status",
            "date_from",
            "date_to",
            "description",
            "approved_by",
            "approved_by_admin_name",
            "approved_at",
            "processed_by",
            "processed_at",
            "created_by",
            "created_by_name",
            "created_by_email",
            "transaction_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "approved_by",
            "approved_by_admin_name",
            "approved_at",
            "processed_by",
            "processed_at",
            "created_by",
            "transaction_id",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        date_from = attrs.get("date_from", getattr(self.instance, "date_from", None))
        date_to = attrs.get("date_to", getattr(self.instance, "date_to", None))
        if date_from and date_to and date_to < date_from:
            raise serializers.ValidationError(
                {"date_to": "date_to cannot be earlier than date_from."}
            )
        return attrs
