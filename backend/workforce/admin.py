from django.contrib import admin

from workforce.models import Employee, LaborGroup


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = (
        "employee_code",
        "full_name",
        "trade",
        "employment_type",
        "daily_rate",
        "organization",
        "is_active",
    )
    list_filter = ("trade", "employment_type", "is_active", "organization")
    search_fields = ("employee_code", "full_name", "phone")


@admin.register(LaborGroup)
class LaborGroupAdmin(admin.ModelAdmin):
    list_display = ("name", "project", "leader", "organization", "is_active")
    list_filter = ("project", "organization")
    search_fields = ("name",)
