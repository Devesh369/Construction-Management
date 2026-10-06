from rest_framework import serializers

from payroll.models import Advance, PayrollRun, PayrollVoucher


class AdvanceSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)

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
            "adjusted_amount",
            "remaining_amount",
            "status",
            "journal_entry",
        ]
        read_only_fields = [
            "id",
            "adjusted_amount",
            "remaining_amount",
            "status",
            "given_by",
            "journal_entry",
        ]


class PayrollVoucherSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)

    class Meta:
        model = PayrollVoucher
        fields = [
            "id",
            "voucher_number",
            "employee",
            "employee_code",
            "employee_name",
            "days_present",
            "half_days",
            "paid_holidays",
            "ot_hours",
            "night_shifts",
            "daily_rate_used",
            "ot_rate_used",
            "basic_pay",
            "ot_pay",
            "night_allowance",
            "gross_pay",
            "advances_deducted",
            "net_pay",
            "payment_mode",
            "status",
            "paid_at",
            "payment_reference",
        ]
        read_only_fields = fields


class PayrollRunSerializer(serializers.ModelSerializer):
    vouchers = PayrollVoucherSerializer(many=True, read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)

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
            "approved_by",
            "approved_at",
            "total_gross",
            "total_advances",
            "total_net",
            "journal_entry",
            "notes",
            "vouchers",
        ]
        read_only_fields = [
            "id",
            "status",
            "created_by",
            "approved_by",
            "approved_at",
            "total_gross",
            "total_advances",
            "total_net",
            "journal_entry",
        ]
