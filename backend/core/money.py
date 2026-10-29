from decimal import ROUND_HALF_UP, Decimal


def q2(value) -> Decimal:
    """
    Round money values to 2 decimal places using ROUND_HALF_UP.
    Returns Decimal('0.00') if value is None.
    """
    if value is None:
        return Decimal("0.00")
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def q3(value) -> Decimal:
    """
    Round material quantities to 3 decimal places using ROUND_HALF_UP.
    """
    if value is None:
        return Decimal("0.000")
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return value.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
