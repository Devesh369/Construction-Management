from decimal import Decimal

from rest_framework import serializers

from ledger.models import Account, JournalEntry, JournalLine, Side


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ["id", "code", "name", "type", "is_active"]
        read_only_fields = ["id"]

    def validate_code(self, value):
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            org = request.user.organization
            qs = Account.objects.filter(organization=org, code=value)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    f"Account code '{value}' already exists in your organization."
                )
        return value

    def validate(self, attrs):
        # On update: cannot change code or type
        if self.instance is not None:
            if "code" in attrs and attrs["code"] != self.instance.code:
                raise serializers.ValidationError(
                    {"code": "Account code cannot be modified once created."}
                )
            if "type" in attrs and attrs["type"] != self.instance.type:
                raise serializers.ValidationError(
                    {"type": "Account type cannot be modified once created."}
                )
        return attrs


class JournalLineSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.code", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)

    class Meta:
        model = JournalLine
        fields = ["id", "account", "account_code", "account_name", "side", "amount", "memo"]
        read_only_fields = fields


class JournalEntrySerializer(serializers.ModelSerializer):
    lines = JournalLineSerializer(many=True, read_only=True)
    posted_by_name = serializers.CharField(source="posted_by.get_full_name", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)

    class Meta:
        model = JournalEntry
        fields = [
            "id",
            "entry_number",
            "date",
            "description",
            "project",
            "project_name",
            "reference_type",
            "reference_id",
            "posted_by",
            "posted_by_name",
            "reverses",
            "reversal_reason",
            "lines",
            "created_at",
        ]
        read_only_fields = fields


class JournalLineInputSerializer(serializers.Serializer):
    account_code = serializers.CharField(required=False, allow_blank=True)
    account_id = serializers.IntegerField(required=False)
    side = serializers.ChoiceField(choices=Side.choices)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    memo = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        if not attrs.get("account_code") and not attrs.get("account_id"):
            raise serializers.ValidationError("Either account_code or account_id must be provided.")
        return attrs


class ManualJournalEntryCreateSerializer(serializers.Serializer):
    date = serializers.DateField(required=True)
    description = serializers.CharField(required=True, min_length=3)
    project_id = serializers.IntegerField(required=False, allow_null=True)
    lines = JournalLineInputSerializer(many=True, required=True)

    def validate_lines(self, value):
        if len(value) < 2:
            raise serializers.ValidationError("A journal entry requires at least 2 lines.")
        return value


class ReverseJournalEntrySerializer(serializers.Serializer):
    reason = serializers.CharField(required=True, min_length=3)
