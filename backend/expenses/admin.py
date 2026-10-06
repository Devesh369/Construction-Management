from django.contrib import admin

from expenses.models import Expense, RunningCostBaseline, Vendor, VendorPayment


@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = ("name", "contact_person", "phone", "organization", "is_active")
    list_filter = ("is_active", "organization")
    search_fields = ("name", "contact_person")


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = (
        "project",
        "category",
        "amount",
        "payment_mode",
        "status",
        "expense_date",
        "organization",
    )
    list_filter = ("category", "status", "payment_mode", "organization")
    search_fields = ("description", "invoice_number")


@admin.register(VendorPayment)
class VendorPaymentAdmin(admin.ModelAdmin):
    list_display = ("vendor", "project", "amount", "payment_date", "payment_mode")
    list_filter = ("payment_mode", "organization")


@admin.register(RunningCostBaseline)
class RunningCostBaselineAdmin(admin.ModelAdmin):
    list_display = ("project", "utility_type", "monthly_baseline")
