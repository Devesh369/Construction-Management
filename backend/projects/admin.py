from django.contrib import admin

from projects.models import BudgetCategory, Project, ProjectMembership


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "organization", "status", "estimated_budget", "actual_spend", "progress_percent")
    list_filter = ("status", "organization")
    search_fields = ("name", "code", "client_name", "location")
    list_select_related = ("organization",)
    readonly_fields = ("actual_spend", "created_at", "updated_at")


@admin.register(ProjectMembership)
class ProjectMembershipAdmin(admin.ModelAdmin):
    list_display = ("project", "user", "site_role", "created_at")
    list_filter = ("site_role", "project__organization")
    search_fields = ("project__name", "project__code", "user__email", "user__name")
    list_select_related = ("project", "user", "organization")
    readonly_fields = ("created_at", "updated_at")


@admin.register(BudgetCategory)
class BudgetCategoryAdmin(admin.ModelAdmin):
    list_display = ("project", "name", "allocated_amount", "created_at")
    list_filter = ("name", "project__organization")
    search_fields = ("project__name", "project__code", "name")
    list_select_related = ("project", "organization")
    readonly_fields = ("created_at", "updated_at")
