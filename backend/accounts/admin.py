from django.contrib import admin

from accounts.models import Invitation, Organization, PasswordResetToken, User


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "currency", "contact_email", "is_active", "created_at")
    search_fields = ("name", "contact_email")


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "name", "role", "organization", "is_active", "is_staff")
    list_filter = ("role", "is_active", "is_staff")
    search_fields = ("email", "name")


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ("email", "role", "organization", "expires_at", "used_at")
    list_filter = ("role", "organization")
    search_fields = ("email",)


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "expires_at", "used_at", "created_at")
    search_fields = ("user__email",)
