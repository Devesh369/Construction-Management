"""
Serializers for Credits Module (Cash Credit Management).
"""

from rest_framework import serializers
from expenses.models import CreditLog, CreditLogExpense, CreditLogStatus


class CreditLogExpenseSerializer(serializers.ModelSerializer):
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
