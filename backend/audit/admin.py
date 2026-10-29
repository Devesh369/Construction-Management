from django.contrib import admin
from .models import AuditLog

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'get_actor', 'action', 'resource_type', 'resource_id', 'ip_address')
    list_filter = ('action', 'resource_type', 'created_at')
    search_fields = ('actor', 'action', 'resource_type', 'resource_id')
    readonly_fields = ('created_at', 'actor', 'action', 'resource_type', 'resource_id', 'changes', 'metadata', 'ip_address', 'user_agent')

    def get_actor(self, obj):
        return obj.actor[0] if obj.actor else 'User'
    get_actor.short_description = 'Actor'
