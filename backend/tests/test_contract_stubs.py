"""
Phase P0 Contract Stub Verification Tests.
Verifies that all Day 3 contract functions exist and adhere to agreed signatures from Section 12.2.
"""

from decimal import Decimal

from attendance.services import AttendanceSummary, haversine_m
from core.money import q2, q3
from payroll.services import calculate_voucher


def test_core_money_q2_rounding():
    """Verify ROUND_HALF_UP behavior in q2()."""
    assert q2("100.555") == Decimal("100.56")
    assert q2("100.554") == Decimal("100.55")
    assert q2(None) == Decimal("0.00")
    assert q3("10.1234") == Decimal("10.123")


def test_attendance_haversine_formula():
    """
    Verify GPS distance between two coordinates.
    Mumbai Nariman Point (18.926, 72.823) to Bandra (19.055, 72.830) is ~14.3 km.
    """
    dist = haversine_m(18.926, 72.823, 19.055, 72.830)
    assert 14000 < dist < 15000, f"Distance {dist}m is unexpected"


def test_payroll_calculate_voucher_pure_function():
    """
    Test wage calculation using the worked example from section 6 (M9):
    Worker rate 800, OT rate 100, multiplier 1.50.
    5 present days, 1 half day, 1 paid holiday, 6 OT hours, advances 1000.
    basic = (5 + 0.5 + 1) * 800 = 5200.00
    ot = 6 * 100 = 600.00
    night = 1 * 800 * 0.50 = 400.00
    gross = 6200.00
    net = 5200.00
    """

    class DummyOrg:
        night_shift_multiplier = Decimal("1.50")

    class DummyEmployee:
        id = 1
        effective_daily_rate = Decimal("800.00")
        ot_hourly_rate = Decimal("100.00")
        upi_id = "worker@upi"
        bank_account_number = ""

    summary = AttendanceSummary(
        employee_id=1,
        days_present=5,
        half_days=1,
        paid_holidays=1,
        ot_hours=Decimal("6.00"),
        night_shifts=1,
    )

    res = calculate_voucher(
        DummyEmployee(), summary, open_advances=Decimal("1000.00"), org=DummyOrg()
    )
    assert res["basic_pay"] == Decimal("5200.00")
    assert res["ot_pay"] == Decimal("600.00")
    assert res["night_allowance"] == Decimal("400.00")
    assert res["gross_pay"] == Decimal("6200.00")
    assert res["advances_deducted"] == Decimal("1000.00")
    assert res["net_pay"] == Decimal("5200.00")
    assert res["payment_mode"] == "UPI"
