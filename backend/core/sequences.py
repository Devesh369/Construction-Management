"""
Gap-free, concurrency-safe sequential document numbering using database row locks.
"""

from django.db import transaction

from core.models import DocumentSequence


def next_number(organization, key: str, prefix: str = "", width: int = 6) -> str:
    """
    Generate the next sequential document code inside a database transaction.
    Uses SELECT ... FOR UPDATE to avoid race conditions.
    Example: next_number(org, "JE", prefix="JE-", width=6) -> "JE-000001"
    """
    with transaction.atomic():
        seq, _ = DocumentSequence.objects.select_for_update().get_or_create(
            organization=organization,
            key=key,
            defaults={"last_value": 0},
        )
        seq.last_value += 1
        seq.save(update_fields=["last_value"])
        number_str = str(seq.last_value).zfill(width)
        return f"{prefix}{number_str}"
