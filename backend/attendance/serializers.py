"""
Attendance module DRF Serializers.
Simplified without GPS or shift requirements.
"""

from decimal import Decimal

from rest_framework import serializers

from attendance.models import (
    Attendance,
    AttendanceStatus,
    Holiday,
    HolidayType,
)


class AttendanceSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    employee_role = serializers.SerializerMethodField()
    daily_rate = serializers.DecimalField(
        source="employee.effective_daily_rate",
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    earning = serializers.SerializerMethodField()
    project_name = serializers.CharField(source="project.name", read_only=True)
    worked_hours = serializers.DecimalField(
        max_digits=4, decimal_places=2, min_value=Decimal("0.00"), max_value=Decimal("24.00"), required=False
    )
    ot_hours = serializers.DecimalField(
        max_digits=4, decimal_places=2, min_value=Decimal("0.00"), max_value=Decimal("24.00"), required=False
    )

    class Meta:
        model = Attendance
        fields = [
            "id",
            "employee",
            "employee_code",
            "employee_name",
            "employee_role",
            "daily_rate",
            "earning",
            "project",
            "project_name",
            "date",
            "status",
            "check_in_time",
            "check_out_time",
            "worked_hours",
            "ot_hours",
            "remarks",
            "is_locked",
            "locked_at",
            "locked_by",
            "marked_by",
        ]
        read_only_fields = ["id", "is_locked", "locked_at", "locked_by", "marked_by"]

    def validate_date(self, value):
        from django.utils import timezone
        if value and value > timezone.localdate():
            raise serializers.ValidationError(
                "Cannot mark attendance for upcoming days. Attendance can only be recorded for today or past dates."
            )
        return value

    def get_employee_role(self, obj):
        trade = (obj.employee.trade or "").upper()
        if trade in ["MASON", "CARPENTER", "ELECTRICIAN", "PLUMBER", "WELDER"]:
            return "KARIGAR"
        return "LABOUR"

    def get_earning(self, obj):
        rate = obj.employee.daily_rate or Decimal("0.00")
        if obj.status == AttendanceStatus.PRESENT:
            base = rate
        elif obj.status == AttendanceStatus.HALF_DAY:
            base = rate * Decimal("0.5")
        else:
            base = Decimal("0.00")
        ot_rate = obj.employee.ot_hourly_rate or Decimal("0.00")
        ot_pay = (obj.ot_hours or Decimal("0.00")) * ot_rate
        return float(base + ot_pay)


class CheckInSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField(required=True)
    project_id = serializers.IntegerField(required=True)


class CheckOutSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField(required=True)
    project_id = serializers.IntegerField(required=True)


class BatchRecordItemSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField(required=True)
    project_id = serializers.IntegerField(required=False, allow_null=True)
    status = serializers.ChoiceField(
        choices=AttendanceStatus.choices, default=AttendanceStatus.PRESENT
    )
    ot_hours = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=Decimal("0.00"), default=Decimal("0.00"), required=False
    )
    remarks = serializers.CharField(required=False, allow_blank=True, default="")


class BatchAttendanceSerializer(serializers.Serializer):
    project_id = serializers.IntegerField(required=False, allow_null=True)
    date = serializers.DateField(required=True)
    group_id = serializers.IntegerField(required=False, allow_null=True)
    group_status = serializers.ChoiceField(
        choices=AttendanceStatus.choices, required=False, allow_null=True
    )
    records = BatchRecordItemSerializer(many=True, required=False, default=list)

    def validate_date(self, value):
        from django.utils import timezone
        if value > timezone.localdate():
            raise serializers.ValidationError(
                "Cannot mark attendance for upcoming days. Only present and past dates are allowed."
            )
        return value


class ApproveAttendanceSerializer(serializers.Serializer):
    project_id = serializers.IntegerField(required=True)
    date = serializers.DateField(required=False, allow_null=True)
    date_from = serializers.DateField(required=False, allow_null=True)
    date_to = serializers.DateField(required=False, allow_null=True)

    def validate(self, attrs):
        date = attrs.get("date")
        date_from = attrs.get("date_from")
        date_to = attrs.get("date_to")
        if not date and not (date_from and date_to):
            raise serializers.ValidationError(
                "Either 'date' or both 'date_from' and 'date_to' must be provided."
            )
        if date_from and date_to and date_to < date_from:
            raise serializers.ValidationError(
                {"date_to": "date_to cannot be earlier than date_from."}
            )
        return attrs


class UnlockAttendanceSerializer(serializers.Serializer):
    project_id = serializers.IntegerField(required=True)
    date = serializers.DateField(required=True)
    reason = serializers.CharField(required=True, min_length=3)


class CloseDaySerializer(serializers.Serializer):
    project_id = serializers.IntegerField(required=True)
    date = serializers.DateField(required=True)


class HolidaySerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=100, required=True, allow_blank=False)
    date = serializers.DateField(required=True)
    project_name = serializers.CharField(source="project.name", read_only=True)

    class Meta:
        model = Holiday
        fields = [
            "id",
            "project",
            "project_name",
            "date",
            "name",
            "holiday_type",
            "is_paid",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
