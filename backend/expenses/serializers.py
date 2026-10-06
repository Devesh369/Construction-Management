from rest_framework import serializers

from expenses.models import Expense, RunningCostBaseline, Vendor, VendorPayment


class VendorSerializer(serializers.ModelSerializer):
    outstanding_balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

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
        ]
        read_only_fields = ["id", "outstanding_balance"]


class ExpenseSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source="vendor.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.name", read_only=True)

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
            "status",
            "created_by",
            "created_by_name",
            "approved_by",
            "approved_at",
            "rejection_reason",
            "cancel_reason",
            "journal_entry",
        ]
        read_only_fields = [
            "id",
            "status",
            "created_by",
            "approved_by",
            "approved_at",
            "rejection_reason",
            "cancel_reason",
            "journal_entry",
        ]


class VendorPaymentSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source="vendor.name", read_only=True)

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
            "journal_entry",
        ]
        read_only_fields = ["id", "paid_by", "journal_entry"]


class RunningCostBaselineSerializer(serializers.ModelSerializer):
    class Meta:
        model = RunningCostBaseline
        fields = ["id", "project", "utility_type", "monthly_baseline"]
