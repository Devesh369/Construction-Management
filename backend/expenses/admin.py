from django.contrib import admin

from expenses.models import (
    CreditLog,
    CreditLogExpense,
    Expense,
    RunningCost,
    RunningCostBaseline,
    Vendor,
    VendorPayment,
)


@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = ("name", "contact_person", "phone", "email", "tax_id", "organization", "is_active", "created_at")
    list_filter = ("is_active", "organization")
    search_fields = ("name", "contact_person", "phone", "tax_id")
    list_select_related = ("organization",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = (
        "project",
        "vendor",
        "category",
        "amount",
        "payment_mode",
        "status",
        "expense_date",
        "created_by",
        "organization",
    )
    list_filter = ("category", "status", "payment_mode", "organization", "project")
    search_fields = ("description", "invoice_number", "vendor__name", "project__name")
    list_select_related = ("project", "vendor", "created_by", "approved_by", "organization", "journal_entry")
    readonly_fields = ("approved_at", "created_at", "updated_at")


@admin.register(VendorPayment)
class VendorPaymentAdmin(admin.ModelAdmin):
    list_display = ("vendor", "project", "amount", "payment_date", "payment_mode", "paid_by", "created_at")
    list_filter = ("payment_mode", "organization", "project")
    search_fields = ("vendor__name", "reference", "notes")
    list_select_related = ("vendor", "project", "paid_by", "organization", "journal_entry")
    readonly_fields = ("created_at", "updated_at")


@admin.register(RunningCostBaseline)
class RunningCostBaselineAdmin(admin.ModelAdmin):
    list_display = ("project", "utility_type", "monthly_baseline", "created_at")
    list_filter = ("utility_type", "organization", "project")
    search_fields = ("project__name", "project__code")
    list_select_related = ("project", "organization")
    readonly_fields = ("created_at", "updated_at")


@admin.register(RunningCost)
class RunningCostAdmin(admin.ModelAdmin):
    list_display = ("project", "date", "amount", "payment_method", "user_name", "user_role", "entered_by", "created_at")
    list_filter = ("payment_method", "project", "organization", "date")
    search_fields = ("description", "user_name", "project__name", "project__code")
    list_select_related = ("project", "entered_by", "organization")
    readonly_fields = ("created_at", "updated_at")


class CreditLogExpenseInline(admin.TabularInline):
    model = CreditLogExpense
    extra = 0
    readonly_fields = ("created_at", "updated_at")


@admin.register(CreditLog)
class CreditLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "credited_by",
        "amount",
        "amount_spent",
        "remaining_balance",
        "payment_method",
        "status",
        "transaction_date",
        "organization",
    )
    list_filter = ("status", "payment_method", "organization", "transaction_date")
    search_fields = ("description", "individual_name", "category", "credited_by__email", "credited_by__name")
    list_select_related = ("credited_by", "project", "employee", "organization")
    readonly_fields = ("created_at", "updated_at")
    inlines = [CreditLogExpenseInline]


@admin.register(CreditLogExpense)
class CreditLogExpenseAdmin(admin.ModelAdmin):
    list_display = ("credit_log", "amount", "date", "recorded_by", "transaction_id", "created_at")
    list_filter = ("date", "organization")
    search_fields = ("description", "transaction_id", "recorded_by__email")
    list_select_related = ("credit_log", "recorded_by", "organization")
    readonly_fields = ("created_at", "updated_at")
