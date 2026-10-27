from django.contrib import admin

from progress.models import DailyProgressReport, MaterialUsage, SitePhoto, TaskProgress, WorkEntry


class TaskProgressInline(admin.TabularInline):
    model = TaskProgress
    extra = 0


class MaterialUsageInline(admin.TabularInline):
    model = MaterialUsage
    extra = 0


class SitePhotoInline(admin.TabularInline):
    model = SitePhoto
    extra = 0


@admin.register(DailyProgressReport)
class DailyProgressReportAdmin(admin.ModelAdmin):
    list_display = ("project", "report_date", "submitted_by", "status", "verified_by", "created_at")
    list_filter = ("status", "project", "organization", "report_date")
    search_fields = ("project__name", "project__code", "summary", "issues")
    list_select_related = ("project", "submitted_by", "verified_by", "organization")
    readonly_fields = ("verified_at", "created_at", "updated_at")
    inlines = [TaskProgressInline, MaterialUsageInline, SitePhotoInline]


@admin.register(TaskProgress)
class TaskProgressAdmin(admin.ModelAdmin):
    list_display = ("task_name", "report", "percent_complete", "created_at")
    list_filter = ("report__project", "report__status")
    search_fields = ("task_name", "notes", "report__project__name")
    list_select_related = ("report", "report__project", "organization")
    readonly_fields = ("created_at", "updated_at")


@admin.register(MaterialUsage)
class MaterialUsageAdmin(admin.ModelAdmin):
    list_display = ("material_name", "quantity", "unit", "report", "task", "created_at")
    list_filter = ("report__project", "unit")
    search_fields = ("material_name", "report__project__name")
    list_select_related = ("report", "task", "organization")
    readonly_fields = ("created_at", "updated_at")


@admin.register(SitePhoto)
class SitePhotoAdmin(admin.ModelAdmin):
    list_display = ("report", "caption", "created_at")
    list_filter = ("report__project",)
    search_fields = ("caption", "report__project__name")
    list_select_related = ("report", "organization")
    readonly_fields = ("created_at", "updated_at")


@admin.register(WorkEntry)
class WorkEntryAdmin(admin.ModelAdmin):
    list_display = ("project", "date", "department", "created_by", "created_at")
    list_filter = ("project", "department", "date", "organization")
    search_fields = ("description", "department", "project__name", "project__code")
    list_select_related = ("project", "created_by", "organization")
    readonly_fields = ("created_at", "updated_at")
