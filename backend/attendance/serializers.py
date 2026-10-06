from rest_framework import serializers

from attendance.models import Attendance, Holiday, NightShiftSession


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = ["id", "project", "date", "name", "holiday_type", "is_paid"]


class NightShiftSessionSerializer(serializers.ModelSerializer):
    supervisor_name = serializers.CharField(source="supervisor.name", read_only=True)

    class Meta:
        model = NightShiftSession
        fields = [
            "id",
            "project",
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
        read_only_fields = ["id", "start_time", "approved_by", "approved_at"]


class AttendanceSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)

    class Meta:
        model = Attendance
        fields = [
            "id",
            "employee",
            "employee_code",
            "employee_name",
            "project",
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
        ]
        read_only_fields = ["id", "is_locked", "locked_at"]
