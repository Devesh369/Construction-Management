from django.contrib import admin

from payroll.models import Advance, PayrollRun, PayrollVoucher


@admin.register(Advance)
class AdvanceAdmin(admin.ModelAdmin):
    list_display = ("employee", "project", "amount", "advance_date", "status", "given_by")
    list_filter = ("status", "organization")


class PayrollVoucherInline(admin.TabularInline):
    model = PayrollVoucher
    extra = 0
    readonly_fields = [f.name for f in PayrollVoucher._meta.fields]

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(PayrollRun)
class PayrollRunAdmin(admin.ModelAdmin):
    list_display = ("project", "period_start", "period_end", "status", "total_gross", "total_net")
    list_filter = ("status", "organization")
    inlines = [PayrollVoucherInline]
