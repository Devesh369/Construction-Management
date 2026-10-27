"""
Accounts request and response serializers.
"""

from decimal import Decimal

from rest_framework import serializers

from accounts.models import Invitation, Organization, User
from core.roles import Role


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class AcceptInviteSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(min_length=10, write_only=True)
    name = serializers.CharField(max_length=150, required=False, allow_blank=True)


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(min_length=10, write_only=True)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(min_length=10, write_only=True)


class UserProfileSerializer(serializers.ModelSerializer):
    def validate_phone(self, value):
        from core.validators import validate_mobile_10_digits
        if value:
            return validate_mobile_10_digits(value)
        return value

    class Meta:
        model = User
        fields = ["id", "email", "name", "phone", "role"]
        read_only_fields = ["id", "email", "role"]


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=150, required=True, allow_blank=False)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        write_only=True,
        required=False,
        min_length=6,
        error_messages={"min_length": "Password must be at least 6 characters long."},
    )

    def validate_phone(self, value):
        from core.validators import validate_mobile_10_digits
        if value:
            return validate_mobile_10_digits(value)
        return value

    class Meta:
        model = User
        fields = ["id", "email", "name", "phone", "role", "password", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


class InvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invitation
        fields = ["id", "email", "name", "role", "expires_at", "used_at", "created_at"]
        read_only_fields = ["id", "expires_at", "used_at", "created_at"]


class CreateInvitationSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    role = serializers.ChoiceField(choices=Role.choices, required=True)


class OrganizationSerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=200, required=True, allow_blank=False)
    workday_hours = serializers.DecimalField(
        max_digits=4, decimal_places=2, min_value=Decimal("0.50"), max_value=Decimal("24.00"), required=False
    )
    half_day_hours = serializers.DecimalField(
        max_digits=4, decimal_places=2, min_value=Decimal("0.50"), max_value=Decimal("24.00"), required=False
    )
    overtime_after_hours = serializers.DecimalField(
        max_digits=4, decimal_places=2, min_value=Decimal("0.50"), max_value=Decimal("24.00"), required=False
    )
    expense_approval_limit = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.00"), required=False
    )

    def validate_contact_phone(self, value):
        from core.validators import validate_mobile_10_digits
        if value:
            return validate_mobile_10_digits(value)
        return value

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
            "expense_approval_limit",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        workday = attrs.get(
            "workday_hours", getattr(self.instance, "workday_hours", Decimal("8.00"))
        )
        half_day = attrs.get(
            "half_day_hours", getattr(self.instance, "half_day_hours", Decimal("4.00"))
        )
        overtime = attrs.get(
            "overtime_after_hours", getattr(self.instance, "overtime_after_hours", Decimal("8.00"))
        )
        approval_limit = attrs.get(
            "expense_approval_limit",
            getattr(self.instance, "expense_approval_limit", Decimal("1000.00")),
        )

        if half_day > workday:
            raise serializers.ValidationError(
                {"half_day_hours": "half_day_hours cannot be greater than workday_hours."}
            )
        if overtime <= Decimal("0.00"):
            raise serializers.ValidationError(
                {"overtime_after_hours": "overtime_after_hours must be greater than 0."}
            )
        if approval_limit < Decimal("0.00"):
            raise serializers.ValidationError(
                {"expense_approval_limit": "expense_approval_limit cannot be negative."}
            )

        return attrs
