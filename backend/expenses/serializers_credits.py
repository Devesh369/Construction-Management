from decimal import Decimal

from rest_framework import serializers

from expenses.models import CreditLog, CreditLogExpense


class CreditLogExpenseSerializer(serializers.ModelSerializer):
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01"), required=True
    )
    date = serializers.DateField(required=True)
    description = serializers.CharField(required=True, allow_blank=False)
    recorded_by_name = serializers.CharField(source="recorded_by.get_full_name", read_only=True)
    recorded_by_email = serializers.CharField(source="recorded_by.email", read_only=True)

    class Meta:
        model = CreditLogExpense
        fields = [
            "id",
            "credit_log",
            "amount",
            "description",
            "date",
            "recorded_by",
            "recorded_by_name",
            "recorded_by_email",
            "transaction_id",
            "created_at",
        ]
        read_only_fields = ["id", "recorded_by", "created_at"]


class CreditLogSerializer(serializers.ModelSerializer):
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01"), required=True
    )
    transaction_date = serializers.DateField(required=True)
    description = serializers.CharField(required=True, allow_blank=False)
    category = serializers.CharField(required=True, allow_blank=False)
    payment_method = serializers.CharField(required=True, allow_blank=False)
    credited_by_name = serializers.CharField(source="credited_by.get_full_name", read_only=True)
    credited_by_email = serializers.CharField(source="credited_by.email", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True, default=None)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True, default=None)
    expenses = CreditLogExpenseSerializer(many=True, read_only=True)

    class Meta:
        model = CreditLog
        fields = [
            "id",
            "transaction_date",
            "credited_by",
            "credited_by_name",
            "credited_by_email",
            "amount",
            "description",
            "project",
            "project_name",
            "employee",
            "employee_name",
            "category",
            "individual_name",
            "payment_method",
            "amount_spent",
            "remaining_balance",
            "last_expense_date",
            "status",
            "expenses",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "amount_spent",
            "remaining_balance",
            "last_expense_date",
            "created_at",
            "updated_at",
        ]
