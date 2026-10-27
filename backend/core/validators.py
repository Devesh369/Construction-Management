import re
from rest_framework import serializers


def validate_mobile_10_digits(value):
    """
    Validates that a mobile/phone number contains exactly 10 digits.
    Strips non-digit characters and normalizes country codes (+91 / 0) to 10 digits.
    """
    if not value:
        return value
    val_str = str(value).strip()
    digits = re.sub(r"\D", "", val_str)
    # If 12 digits starting with country code 91 (e.g. +91 9876543210)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    # If 11 digits starting with 0
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]

    if len(digits) != 10:
        raise serializers.ValidationError("Mobile number must be exactly 10 digits.")
    return digits
