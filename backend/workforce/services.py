"""
Workforce services.
"""

from core.sequences import next_number


def generate_employee_code(org) -> str:
    """Generate EMP-0001 code."""
    return next_number(org, key="EMP", prefix="EMP-", width=4)
