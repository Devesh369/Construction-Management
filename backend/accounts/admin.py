from django.contrib import admin

from accounts.models import Invitation, Organization, PasswordResetToken, User


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "currency", "contact_email", "contact_phone", "is_active", "created_at")
    list_filter = ("currency", "is_active")
    search_fields = ("name", "contact_email", "contact_phone")
    readonly_fields = ("created_at", "updated_at")


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "name", "role", "organization", "is_active", "is_staff")
    list_filter = ("role", "is_active", "is_staff")
    search_fields = ("email", "name", "phone")
    list_select_related = ("organization",)
    readonly_fields = ("created_at", "failed_login_count", "locked_until", "token_version", "deleted_at")


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ("email", "name", "role", "organization", "expires_at", "used_at")
    list_filter = ("role", "organization")
    search_fields = ("email", "name")
    list_select_related = ("organization", "invited_by")
    readonly_fields = ("token_hash", "created_at", "updated_at")


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "expires_at", "used_at", "created_at")
    search_fields = ("user__email",)
    list_select_related = ("user",)
    readonly_fields = ("token_hash", "created_at")
