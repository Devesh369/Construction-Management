from decimal import Decimal

from rest_framework import serializers
from ledger.models import Transaction, TransactionType, TransactionCategory, TransactionStatus, TransactionMethod


class TransactionSerializer(serializers.ModelSerializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"), required=True)
    date = serializers.DateField(required=True)
    payer_name = serializers.CharField(max_length=255, required=True, allow_blank=False)
    payee_name = serializers.CharField(max_length=255, required=True, allow_blank=False)
    recorded_by_name = serializers.CharField(source="recorded_by.get_full_name", read_only=True)
    recorded_by_email = serializers.CharField(source="recorded_by.email", read_only=True)
    net_payable_balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True, required=False)

    class Meta:
        model = Transaction
        fields = [
            "id",
            "transaction_id",
            "date",
            "type",
            "category",
            "payer_name",
            "payee_name",
            "amount",
            "method",
            "status",
            "description",
            "recorded_by",
            "recorded_by_name",
            "recorded_by_email",
            "metadata",
            "net_payable_balance",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "transaction_id",
            "recorded_by",
            "created_at",
            "updated_at",
        ]
