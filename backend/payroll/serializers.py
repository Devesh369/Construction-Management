"""
Serializers for Worker Advances, Payroll Runs, and Itemized Vouchers.
"""

from decimal import Decimal

from rest_framework import serializers

from payroll.models import Advance, PayrollRun, PayrollVoucher


class AdvanceSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    given_by_name = serializers.CharField(source="given_by.name", read_only=True)
    remaining_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Advance
        fields = [
            "id",
            "employee",
            "employee_code",
            "employee_name",
            "project",
            "amount",
            "advance_date",
            "reason",
            "payment_mode",
            "given_by",
            "given_by_name",
            "adjusted_amount",
            "remaining_amount",
            "status",
            "journal_entry",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "adjusted_amount",
            "remaining_amount",
            "status",
            "given_by",
            "given_by_name",
            "journal_entry",
            "created_at",
            "updated_at",
        ]

    def validate_amount(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError("Advance amount must be greater than zero.")
        return value


class PayrollVoucherSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    trade = serializers.CharField(source="employee.trade", read_only=True)

    class Meta:
        model = PayrollVoucher
        fields = [
            "id",
            "voucher_number",
            "employee",
            "employee_code",
            "employee_name",
            "trade",
            "days_present",
            "half_days",
            "paid_holidays",
            "ot_hours",
            "daily_rate_used",
            "ot_rate_used",
            "basic_pay",
            "ot_pay",
            "gross_pay",
            "advances_deducted",
            "net_pay",
            "payment_mode",
            "status",
            "paid_at",
            "payment_reference",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "voucher_number",
            "employee",
            "employee_code",
            "employee_name",
            "trade",
            "days_present",
            "half_days",
            "paid_holidays",
            "ot_hours",
            "daily_rate_used",
            "ot_rate_used",
            "basic_pay",
            "ot_pay",
            "gross_pay",
            "net_pay",
            "status",
            "paid_at",
            "payment_reference",
            "created_at",
        ]


class PayrollVoucherUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollVoucher
        fields = ["advances_deducted", "payment_mode"]


class PayrollRunSerializer(serializers.ModelSerializer):
    vouchers = PayrollVoucherSerializer(many=True, read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.name", read_only=True)
    approved_by_name = serializers.CharField(source="approved_by.name", read_only=True)
    warnings = serializers.ListField(child=serializers.CharField(), read_only=True, default=list)

    class Meta:
        model = PayrollRun
        fields = [
            "id",
            "project",
            "project_name",
            "period_start",
            "period_end",
            "status",
            "created_by",
            "created_by_name",
            "approved_by",
            "approved_by_name",
            "approved_at",
            "total_gross",
            "total_advances",
            "total_net",
            "journal_entry",
            "notes",
            "vouchers",
            "warnings",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "created_by",
            "created_by_name",
            "approved_by",
            "approved_by_name",
            "approved_at",
            "total_gross",
            "total_advances",
            "total_net",
            "journal_entry",
            "warnings",
            "created_at",
            "updated_at",
        ]


class PayrollRunCreateSerializer(serializers.Serializer):
    project_id = serializers.IntegerField()
    period_start = serializers.DateField()
    period_end = serializers.DateField()
