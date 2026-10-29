"""
Audit action constants as defined in Section 10.2 of the master brief.
"""

from django.db import models


class AuditAction(models.TextChoices):
    # Auth & Users
    LOGIN_SUCCESS = "LOGIN_SUCCESS", "Login Success"
    LOGIN_FAILED = "LOGIN_FAILED", "Login Failed"
    LOGOUT = "LOGOUT", "Logout"
    USER_INVITED = "USER_INVITED", "User Invited"
    USER_CREATED = "USER_CREATED", "User Created"
    USER_UPDATED = "USER_UPDATED", "User Updated"
    USER_DELETED = "USER_DELETED", "User Deleted"
    PASSWORD_CHANGED = "PASSWORD_CHANGED", "Password Changed"
    PASSWORD_RESET = "PASSWORD_RESET", "Password Reset"
    ORG_SETTINGS_UPDATED = "ORG_SETTINGS_UPDATED", "Org Settings Updated"

    # Projects
    PROJECT_CREATED = "PROJECT_CREATED", "Project Created"
    PROJECT_UPDATED = "PROJECT_UPDATED", "Project Updated"
    BUDGET_CHANGED = "BUDGET_CHANGED", "Budget Changed"
    GEOFENCE_CHANGED = "GEOFENCE_CHANGED", "Geofence Changed"

    # Workforce
    EMPLOYEE_PAY_CHANGED = "EMPLOYEE_PAY_CHANGED", "Employee Pay Changed"

    # Attendance
    ATTENDANCE_LOCKED = "ATTENDANCE_LOCKED", "Attendance Locked"
    ATTENDANCE_UNLOCKED = "ATTENDANCE_UNLOCKED", "Attendance Unlocked"
    ATTENDANCE_OFFSITE_ATTEMPT = "ATTENDANCE_OFFSITE_ATTEMPT", "Attendance Offsite Attempt"
    NIGHT_SHIFT_APPROVED = "NIGHT_SHIFT_APPROVED", "Night Shift Approved"

    # Progress
    DPR_VERIFIED = "DPR_VERIFIED", "DPR Verified"
    DPR_REJECTED = "DPR_REJECTED", "DPR Rejected"

    # Expenses & Vendors
    EXPENSE_APPROVED = "EXPENSE_APPROVED", "Expense Approved"
    EXPENSE_REJECTED = "EXPENSE_REJECTED", "Expense Rejected"
    EXPENSE_CANCELLED = "EXPENSE_CANCELLED", "Expense Cancelled"
    VENDOR_PAYMENT_RECORDED = "VENDOR_PAYMENT_RECORDED", "Vendor Payment Recorded"

    # Payroll
    ADVANCE_GIVEN = "ADVANCE_GIVEN", "Advance Given"
    PAYROLL_CREATED = "PAYROLL_CREATED", "Payroll Created"
    PAYROLL_APPROVED = "PAYROLL_APPROVED", "Payroll Approved"
    PAYROLL_CANCELLED = "PAYROLL_CANCELLED", "Payroll Cancelled"
    VOUCHER_PAID = "VOUCHER_PAID", "Voucher Paid"

    # Ledger
    JOURNAL_POSTED_MANUAL = "JOURNAL_POSTED_MANUAL", "Journal Posted Manual"
    JOURNAL_REVERSED = "JOURNAL_REVERSED", "Journal Reversed"

    # Reports
    REPORT_EXPORTED = "REPORT_EXPORTED", "Report Exported"
