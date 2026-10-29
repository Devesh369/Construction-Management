import django_filters

from ledger.models import JournalEntry


class JournalEntryFilter(django_filters.FilterSet):
    account = django_filters.NumberFilter(field_name="lines__account", distinct=True)
    account_code = django_filters.CharFilter(field_name="lines__account__code", distinct=True)
    project = django_filters.NumberFilter(field_name="project_id")
    reference_type = django_filters.CharFilter(field_name="reference_type")
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = JournalEntry
        fields = [
            "account",
            "account_code",
            "project",
            "reference_type",
            "date_from",
            "date_to",
        ]
