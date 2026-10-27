from decimal import Decimal

from rest_framework import serializers

from attendance.models import (
    Attendance,
    AttendanceStatus,
    Holiday,
    NightShiftSession,
    ShiftType,
)


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = ["id", "project", "date", "name", "holiday_type", "is_paid"]
        read_only_fields = ["id"]


class AttendanceSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    employee_trade = serializers.CharField(source="employee.trade", read_only=True)
    employee_phone = serializers.CharField(source="employee.phone", read_only=True)
    employee_role = serializers.SerializerMethodField()
    daily_rate = serializers.DecimalField(source="employee.daily_rate", max_digits=10, decimal_places=2, read_only=True)
    earning = serializers.SerializerMethodField()
    project_name = serializers.CharField(source="project.name", read_only=True)

    class Meta:
        model = Attendance
        fields = [
            "id",
            "employee",
            "employee_code",
            "employee_name",
            "employee_trade",
            "employee_phone",
            "employee_role",
            "daily_rate",
            "earning",
            "project",
            "project_name",
            "date",
            "shift_type",
            "status",
            "check_in_time",
            "check_out_time",
            "worked_hours",
            "ot_hours",
            "latitude",
            "longitude",
            "distance_m",
            "is_geofence_verified",
            "method",
            "night_shift",
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
            raise serializers.ValidationError("Cannot mark attendance for upcoming days. Attendance can only be recorded for today or past dates.")
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

    def validate_date(self, value):
        from django.utils import timezone
        if value > timezone.localdate():
            raise serializers.ValidationError(
                "Cannot mark attendance for upcoming days. Only present and past dates are allowed."
            )
        return value


class CheckInSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField(required=True)
    project_id = serializers.IntegerField(required=True)
    latitude = serializers.FloatField(required=True)
    longitude = serializers.FloatField(required=True)
    shift_type = serializers.ChoiceField(choices=ShiftType.choices, default=ShiftType.DAY)


class CheckOutSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField(required=True)
    project_id = serializers.IntegerField(required=True)
    latitude = serializers.FloatField(required=False, allow_null=True)
    longitude = serializers.FloatField(required=False, allow_null=True)
    shift_type = serializers.ChoiceField(choices=ShiftType.choices, default=ShiftType.DAY)


class BatchRecordItemSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField(required=True)
    project_id = serializers.IntegerField(required=False, allow_null=True)
    shift_type = serializers.ChoiceField(
        choices=ShiftType.choices, default=ShiftType.DAY, required=False
    )
    status = serializers.ChoiceField(
        choices=AttendanceStatus.choices, default=AttendanceStatus.PRESENT
    )
    ot_hours = serializers.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("0.00"), required=False
    )
    remarks = serializers.CharField(required=False, allow_blank=True, default="")


class BatchAttendanceSerializer(serializers.Serializer):
    project_id = serializers.IntegerField(required=False, allow_null=True)
    date = serializers.DateField(required=True)
    shift_type = serializers.ChoiceField(choices=ShiftType.choices, default=ShiftType.DAY)
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
        if not attrs.get("date") and not (attrs.get("date_from") and attrs.get("date_to")):
            raise serializers.ValidationError(
                "Either 'date' or both 'date_from' and 'date_to' must be provided."
            )
        return attrs


class UnlockAttendanceSerializer(serializers.Serializer):
    project_id = serializers.IntegerField(required=True)
    date = serializers.DateField(required=True)
    reason = serializers.CharField(required=True, min_length=3)


class CloseDaySerializer(serializers.Serializer):
    project_id = serializers.IntegerField(required=True)
    date = serializers.DateField(required=True)


class NightShiftSessionSerializer(serializers.ModelSerializer):
    supervisor_name = serializers.CharField(source="supervisor.get_full_name", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)

    class Meta:
        model = NightShiftSession
        fields = [
            "id",
            "project",
            "project_name",
            "shift_date",
            "supervisor",
            "supervisor_name",
            "start_time",
            "end_time",
            "safety_checklist_signed",
            "checklist_notes",
            "work_completed",
            "status",
            "approved_by",
            "approved_at",
        ]
        read_only_fields = ["id", "start_time", "status", "approved_by", "approved_at"]


class NightShiftCreateSerializer(serializers.Serializer):
    project_id = serializers.IntegerField(required=True)
    shift_date = serializers.DateField(required=True)
    employee_ids = serializers.ListField(
        child=serializers.IntegerField(), required=True, min_length=1
    )
    safety_checklist_signed = serializers.BooleanField(required=True)
    checklist_notes = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_shift_date(self, value):
        from django.utils import timezone
        if value > timezone.localdate():
            raise serializers.ValidationError(
                "Cannot create night shift session for upcoming days. Only present and past dates are allowed."
            )
        return value


class NightShiftCompleteSerializer(serializers.Serializer):
    end_time = serializers.DateTimeField(required=False, allow_null=True)
    work_completed = serializers.CharField(required=False, allow_blank=True, default="")
