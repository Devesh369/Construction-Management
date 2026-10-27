from django.contrib import admin

from attendance.models import Attendance, Holiday


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ("employee", "project", "date", "status", "is_locked")
    list_filter = ("status", "is_locked", "organization")
    search_fields = ("employee__employee_code", "employee__full_name")


@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):
    list_display = ("date", "name", "project", "holiday_type", "is_paid")
    list_filter = ("holiday_type", "is_paid", "organization")
