from django.contrib import admin

from core.models import DocumentSequence


@admin.register(DocumentSequence)
class DocumentSequenceAdmin(admin.ModelAdmin):
    list_display = ("organization", "key", "last_value")
    list_filter = ("organization", "key")
    search_fields = ("key", "organization__name")
