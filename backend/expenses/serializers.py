"""
Serializers for Expenses, Vendors, Payments, and Running Cost Baselines.
"""

from decimal import Decimal

from rest_framework import serializers

from core.money import q2
from core.roles import Role
from expenses.models import (
    Expense,
    ExpenseCategory,
    PaymentMode,
    RunningCostBaseline,
    UtilityType,
    Vendor,
    VendorPayment,
)


class VendorSerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=200, required=True, allow_blank=False)
    outstanding_balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    contact_person = serializers.CharField(required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    tax_id = serializers.CharField(required=False, allow_blank=True)

    def validate_phone(self, value):
        if not value or not str(value).strip():
            return ""
        from core.validators import validate_mobile_10_digits

        return validate_mobile_10_digits(value)

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, "copy") else dict(data)
        if "gstin" in data and not data.get("tax_id"):
            data["tax_id"] = data["gstin"]
        return super().to_internal_value(data)

    class Meta:
        model = Vendor
        fields = [
            "id",
            "name",
            "contact_person",
            "phone",
            "email",
            "address",
            "tax_id",
            "is_active",
            "outstanding_balance",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "outstanding_balance", "created_at", "updated_at"]


class ExpenseSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source="vendor.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.name", read_only=True)
    approved_by_name = serializers.CharField(source="approved_by.name", read_only=True)
    spike_warning = serializers.SerializerMethodField()
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01"), required=True
    )
    description = serializers.CharField(required=True, allow_blank=False)
    expense_date = serializers.DateField(required=True)

    class Meta:
        model = Expense
        fields = [
            "id",
            "project",
            "vendor",
            "vendor_name",
            "category",
            "description",
            "amount",
            "expense_date",
            "payment_mode",
            "invoice_number",
            "due_date",
            "receipt",
            "is_recurring",
            "details",
            "spike_warning",
            "status",
            "created_by",
            "created_by_name",
            "approved_by",
            "approved_by_name",
            "approved_at",
            "rejection_reason",
            "cancel_reason",
            "journal_entry",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "spike_warning",
            "status",
            "created_by",
            "created_by_name",
            "approved_by",
            "approved_by_name",
            "approved_at",
            "rejection_reason",
            "cancel_reason",
            "journal_entry",
            "created_at",
            "updated_at",
        ]

    def get_spike_warning(self, obj) -> bool:
        if obj.category != ExpenseCategory.UTILITY:
            return False
        details = obj.details or {}
        if isinstance(details, dict) and "spike_warning" in details:
            return bool(details["spike_warning"])
        u_type = details.get("utility_type")
        if not u_type or not obj.project:
            return False
        baseline = RunningCostBaseline.objects.filter(
            project=obj.project, utility_type=u_type
        ).first()
        if baseline and obj.amount > q2(baseline.monthly_baseline * Decimal("1.25")):
            return True
        return False

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, "copy") else dict(data)

        # Normalize category aliases
        cat = data.get("category")
        if cat == "EQUIPMENT":
            data["category"] = ExpenseCategory.EQUIPMENT_RENTAL
        elif cat == "LABOR":
            data["category"] = ExpenseCategory.OTHER

        # Empty vendor string from form -> None
        if "vendor" in data and (
            data["vendor"] == "" or data["vendor"] == "null" or data["vendor"] is None
        ):
            data["vendor"] = None

        # Details handling: support stringified JSON in multipart/form-data
        details = data.get("details")
        if isinstance(details, str):
            import json

            try:
                details = json.loads(details)
            except Exception:
                details = {}
        elif not isinstance(details, dict):
            details = {}

        # Allow flat form fields to populate details
        if "vehicle_number" in data and data["vehicle_number"]:
            details["vehicle_number"] = data["vehicle_number"]
        if "distance_km" in data and data["distance_km"] not in (None, ""):
            details["distance_km"] = data["distance_km"]
        if "utility_type" in data and data["utility_type"]:
            details["utility_type"] = data["utility_type"]
        if "billing_month" in data and data["billing_month"]:
            details["billing_month"] = data["billing_month"]

        data["details"] = details
        return super().to_internal_value(data)

    def validate(self, attrs):
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None
        org = user.organization if user else None

        category = attrs.get("category") or (self.instance.category if self.instance else None)
        amount = attrs.get("amount") or (self.instance.amount if self.instance else None)
        payment_mode = attrs.get("payment_mode") or (
            self.instance.payment_mode if self.instance else PaymentMode.CASH
        )
        receipt = attrs.get("receipt") or (self.instance.receipt if self.instance else None)
        details = dict(attrs.get("details", getattr(self.instance, "details", {})) or {})

        # 1. Role check: SUPERVISOR can only create TRANSPORT expenses
        if user and getattr(user, "role", None) == Role.SUPERVISOR:
            if category != ExpenseCategory.TRANSPORT:
                raise serializers.ValidationError(
                    {"category": "Supervisors are only permitted to log transport expenses."}
                )

        # 2. Receipt check: required if amount > org.expense_approval_limit
        if org and amount and amount > org.expense_approval_limit and not receipt:
            raise serializers.ValidationError(
                {
                    "receipt": f"Receipt is required for expenses exceeding ₹{org.expense_approval_limit:,.2f}."
                }
            )

        # 3. Credit purchase check
        if payment_mode == PaymentMode.CREDIT:
            vendor = attrs.get("vendor") or (self.instance.vendor if self.instance else None)
            due_date = attrs.get("due_date") or (self.instance.due_date if self.instance else None)
            if not vendor:
                raise serializers.ValidationError(
                    {
                        "vendor": "Credit purchase requires an assigned vendor. Please select or register a vendor."
                    }
                )
            if not due_date:
                raise serializers.ValidationError(
                    {"due_date": "Credit purchase requires a credit due date."}
                )

        # 4. Category-specific details
        if category == ExpenseCategory.UTILITY:
            u_type = details.get("utility_type")
            if not u_type or u_type not in UtilityType.values:
                details["utility_type"] = UtilityType.ELECTRICITY
            if not details.get("billing_month"):
                from django.utils import timezone

                details["billing_month"] = timezone.now().strftime("%Y-%m")
            attrs["details"] = details

        elif category == ExpenseCategory.TRANSPORT:
            if not details.get("vehicle_number"):
                details["vehicle_number"] = "SITE-LOGISTICS"
            dist = details.get("distance_km")
            if dist is None or str(dist).strip() == "":
                details["distance_km"] = 0
            else:
                try:
                    if Decimal(str(dist)) < Decimal("0"):
                        raise ValueError
                except Exception:
                    raise serializers.ValidationError(
                        {"details": "Transport expense requires distance_km >= 0."}
                    )
            attrs["details"] = details

            if details.get("is_machinery_transfer") and not details.get("destination_project_id"):
                raise serializers.ValidationError(
                    {"details": "Machinery transfer requires destination_project_id."}
                )

        return attrs


class VendorPaymentSerializer(serializers.ModelSerializer):
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01"), required=True
    )
    payment_date = serializers.DateField(required=True)
    reference = serializers.CharField(max_length=100, required=True, allow_blank=False)
    vendor_name = serializers.CharField(source="vendor.name", read_only=True)
    paid_by_name = serializers.CharField(source="paid_by.name", read_only=True)

    class Meta:
        model = VendorPayment
        fields = [
            "id",
            "vendor",
            "vendor_name",
            "project",
            "amount",
            "payment_date",
            "payment_mode",
            "reference",
            "notes",
            "paid_by",
            "paid_by_name",
            "journal_entry",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "vendor",
            "paid_by",
            "paid_by_name",
            "journal_entry",
            "created_at",
        ]

    def validate_amount(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError("Payment amount must be greater than zero.")
        return value


class RunningCostBaselineSerializer(serializers.ModelSerializer):
    class Meta:
        model = RunningCostBaseline
        fields = ["id", "project", "utility_type", "monthly_baseline", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]
