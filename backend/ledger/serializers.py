from rest_framework import serializers

from ledger.models import Account, JournalEntry, JournalLine


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ["id", "code", "name", "type", "is_active"]
        read_only_fields = ["id"]


class JournalLineSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.code", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)

    class Meta:
        model = JournalLine
        fields = ["id", "account", "account_code", "account_name", "side", "amount", "memo"]
        read_only_fields = fields


class JournalEntrySerializer(serializers.ModelSerializer):
    lines = JournalLineSerializer(many=True, read_only=True)

    class Meta:
        model = JournalEntry
        fields = [
            "id",
            "entry_number",
            "date",
            "description",
            "project",
            "reference_type",
            "reference_id",
            "lines",
            "reversal_reason",
            "created_at",
        ]
        read_only_fields = fields
