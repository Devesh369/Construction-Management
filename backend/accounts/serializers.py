"""
Accounts serializers stub / base implementation.
"""

from rest_framework import serializers

from accounts.models import Invitation, Organization, User


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "address",
            "contact_email",
            "contact_phone",
            "currency",
            "workday_hours",
            "half_day_hours",
            "overtime_after_hours",
            "night_shift_multiplier",
            "expense_approval_limit",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "name", "phone", "role", "is_active", "created_at"]
        read_only_fields = ["id", "email", "created_at"]


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "name", "phone", "role"]
        read_only_fields = ["id", "email", "role"]


class InvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invitation
        fields = ["id", "email", "name", "role", "expires_at", "used_at", "created_at"]
        read_only_fields = ["id", "expires_at", "used_at", "created_at"]
