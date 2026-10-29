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
        "primary_project",
        "organization",
        "is_active",
    )
    list_filter = ("trade", "employment_type", "is_active", "organization")
    search_fields = ("employee_code", "full_name", "phone", "email")
    list_select_related = ("organization", "primary_project", "group")
    readonly_fields = ("created_at", "updated_at", "deleted_at")


@admin.register(LaborGroup)
class LaborGroupAdmin(admin.ModelAdmin):
    list_display = ("name", "project", "leader", "organization", "is_active", "created_at")
    list_filter = ("is_active", "project", "organization")
    search_fields = ("name", "project__name", "leader__full_name")
    list_select_related = ("project", "leader", "organization")
    readonly_fields = ("created_at", "updated_at")
