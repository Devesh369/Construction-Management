"""
Serializers for UPAD Payments module.
"""

from rest_framework import serializers
from payroll.models import Payment, PaymentType, PaymentMethod, PaymentLifecycleStatus
from workforce.serializers import EmployeeSerializer


class PaymentSerializer(serializers.ModelSerializer):
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
