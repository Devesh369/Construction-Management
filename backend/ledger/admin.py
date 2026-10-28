from django.contrib import admin

from ledger.models import Account, JournalEntry, JournalLine, Transaction


class JournalLineInline(admin.TabularInline):
    model = JournalLine
    extra = 0
    readonly_fields = [f.name for f in JournalLine._meta.fields]

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "type", "organization", "is_active", "created_at")
    list_filter = ("type", "is_active", "organization")
    search_fields = ("code", "name")
    list_select_related = ("organization",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = (
        "entry_number",
        "date",
        "reference_type",
        "project",
        "posted_by",
        "organization",
        "description",
    )
    list_filter = ("reference_type", "organization", "date", "project")
    search_fields = ("entry_number", "description", "project__name")
    list_select_related = ("project", "posted_by", "organization")
    inlines = [JournalLineInline]
    readonly_fields = [f.name for f in JournalEntry._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(JournalLine)
class JournalLineAdmin(admin.ModelAdmin):
    list_display = ("entry", "account", "side", "amount", "memo", "created_at")
    list_filter = ("side", "account__type", "organization")
    search_fields = ("memo", "account__code", "account__name", "entry__entry_number")
    list_select_related = ("entry", "account", "organization")
    readonly_fields = [f.name for f in JournalLine._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        "transaction_id",
        "date",
        "type",
        "category",
        "payer_name",
        "payee_name",
        "amount",
        "method",
        "status",
        "recorded_by",
        "created_at",
    )
    list_filter = ("type", "category", "method", "status", "organization", "date")
    search_fields = ("transaction_id", "payer_name", "payee_name", "description")
    list_select_related = ("recorded_by", "organization")
    readonly_fields = ("created_at", "updated_at")
