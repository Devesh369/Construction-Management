from django.contrib import admin

from projects.models import BudgetCategory, Project, ProjectMembership


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "organization", "status", "estimated_budget", "actual_spend")
    list_filter = ("status", "organization")
    search_fields = ("name", "code")


@admin.register(ProjectMembership)
class ProjectMembershipAdmin(admin.ModelAdmin):
    list_display = ("project", "user", "site_role")
    search_fields = ("project__name", "user__email")


@admin.register(BudgetCategory)
class BudgetCategoryAdmin(admin.ModelAdmin):
    list_display = ("project", "name", "allocated_amount")
    search_fields = ("project__name", "name")
