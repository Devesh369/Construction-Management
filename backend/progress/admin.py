from django.contrib import admin

from progress.models import DailyProgressReport, MaterialUsage, SitePhoto, TaskProgress


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
    list_display = ("project", "report_date", "submitted_by", "status", "verified_by")
    list_filter = ("status", "project", "organization")
    inlines = [TaskProgressInline, MaterialUsageInline, SitePhotoInline]
