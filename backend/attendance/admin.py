from django.contrib import admin

from attendance.models import Attendance, Holiday


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = (
        "employee",
        "project",
        "date",
        "status",
        "worked_hours",
        "ot_hours",
        "is_locked",
        "is_settled",
    )
    list_filter = ("status", "is_locked", "is_settled", "date", "organization", "project")
    search_fields = ("employee__employee_code", "employee__full_name", "project__name")
    list_select_related = ("employee", "project", "organization", "marked_by")
    readonly_fields = ("locked_at", "locked_by", "settled_at", "created_at", "updated_at")


@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):
    list_display = ("date", "name", "project", "holiday_type", "is_paid", "organization")
    list_filter = ("holiday_type", "is_paid", "organization", "project")
    search_fields = ("name", "project__name")
    list_select_related = ("project", "organization")
    readonly_fields = ("created_at", "updated_at")
