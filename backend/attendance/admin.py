from django.contrib import admin

from attendance.models import Attendance, Holiday, NightShiftSession


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ("employee", "project", "date", "shift_type", "status", "is_locked")
    list_filter = ("status", "shift_type", "is_locked", "organization")
    search_fields = ("employee__employee_code", "employee__full_name")


@admin.register(NightShiftSession)
class NightShiftSessionAdmin(admin.ModelAdmin):
    list_display = ("project", "shift_date", "supervisor", "status", "safety_checklist_signed")
    list_filter = ("status", "organization")


@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):
    list_display = ("date", "name", "project", "holiday_type", "is_paid")
    list_filter = ("holiday_type", "is_paid", "organization")
