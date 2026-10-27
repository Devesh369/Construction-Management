from django.contrib import admin

from payroll.models import Advance, Payment, PayrollRun, PayrollVoucher


@admin.register(Advance)
class AdvanceAdmin(admin.ModelAdmin):
    list_display = (
        "employee",
        "project",
        "amount",
        "adjusted_amount",
        "advance_date",
        "payment_mode",
        "status",
        "given_by",
        "created_at",
    )
    list_filter = ("status", "payment_mode", "organization", "project")
    search_fields = ("employee__full_name", "employee__employee_code", "reason")
    list_select_related = ("employee", "project", "given_by", "organization")
    readonly_fields = ("created_at", "updated_at")


class PayrollVoucherInline(admin.TabularInline):
    model = PayrollVoucher
    extra = 0
    readonly_fields = [f.name for f in PayrollVoucher._meta.fields]

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(PayrollRun)
class PayrollRunAdmin(admin.ModelAdmin):
    list_display = (
        "project",
        "period_start",
        "period_end",
        "status",
        "total_gross",
        "total_advances",
        "total_net",
        "created_by",
        "created_at",
    )
    list_filter = ("status", "organization", "project")
    search_fields = ("project__name", "project__code")
    list_select_related = ("project", "created_by", "approved_by", "organization")
    readonly_fields = (
        "total_gross",
        "total_advances",
        "total_net",
        "approved_at",
        "created_at",
        "updated_at",
    )
    inlines = [PayrollVoucherInline]


@admin.register(PayrollVoucher)
class PayrollVoucherAdmin(admin.ModelAdmin):
    list_display = (
        "voucher_number",
        "employee",
        "run",
        "days_present",
        "half_days",
        "ot_hours",
        "gross_pay",
        "advances_deducted",
        "net_pay",
        "payment_mode",
        "status",
        "paid_at",
    )
    list_filter = ("status", "payment_mode", "organization")
    search_fields = ("voucher_number", "employee__full_name", "employee__employee_code")
    list_select_related = ("run", "run__project", "employee", "organization")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "employee",
        "project",
        "type",
        "amount",
        "method",
        "status",
        "date_from",
        "date_to",
        "created_by",
        "created_at",
    )
    list_filter = ("type", "status", "method", "organization", "project")
    search_fields = (
        "employee__full_name",
        "employee__employee_code",
        "description",
        "transaction_id",
    )
    list_select_related = (
        "employee",
        "project",
        "created_by",
        "approved_by",
        "processed_by",
        "organization",
    )
    readonly_fields = ("approved_at", "processed_at", "created_at", "updated_at")
