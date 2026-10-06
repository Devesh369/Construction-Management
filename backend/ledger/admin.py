from django.contrib import admin

from ledger.models import Account, JournalEntry, JournalLine


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
    list_display = ("code", "name", "type", "organization", "is_active")
    list_filter = ("type", "is_active", "organization")
    search_fields = ("code", "name")


@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = ("entry_number", "date", "reference_type", "organization", "description")
    list_filter = ("reference_type", "organization", "date")
    search_fields = ("entry_number", "description")
    inlines = [JournalLineInline]
    readonly_fields = [f.name for f in JournalEntry._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
