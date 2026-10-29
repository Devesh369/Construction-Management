from django.contrib import admin

from .models import CostEstimate, LocationCostIndex


@admin.register(LocationCostIndex)
class LocationCostIndexAdmin(admin.ModelAdmin):
    list_display = (
        "city",
        "state",
        "area_type",
        "base_rate_standard",
        "base_rate_premium",
        "material_index",
        "labour_index",
        "updated_at",
    )
    list_filter = ("area_type", "state")
    search_fields = ("city", "state", "notes")
    ordering = ("city",)


@admin.register(CostEstimate)
class CostEstimateAdmin(admin.ModelAdmin):
    list_display = (
        "project_name",
        "city",
        "quality_level",
        "total_builtup_area",
        "margin_percent",
        "formatted_grand_total",
        "formatted_cost_per_sqft",
        "used_fallback",
        "owner",
        "created_at",
    )
    list_filter = ("city", "quality_level", "project_type", "used_fallback", "created_at")
    search_fields = ("project_name", "city", "state", "owner__email", "owner__username")
    readonly_fields = (
        "subtotal",
        "contingency_amount",
        "margin_amount",
        "gst_or_taxes",
        "grand_total",
        "cost_per_sqft",
        "result_json",
        "created_at",
        "updated_at",
    )
