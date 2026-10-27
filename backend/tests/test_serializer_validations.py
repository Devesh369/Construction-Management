"""
Tests for fortified DRF serializer validations (Phase 4).
Verifies that invalid boundaries, missing fields, and inverted dates
are strictly rejected at serializer layer with clean validation errors.
"""

from decimal import Decimal
import pytest

from accounts.models import Organization
from accounts.serializers import UserSerializer
from projects.serializers import ProjectSerializer, BudgetCategorySerializer
from expenses.serializers import ExpenseSerializer
from expenses.serializers_running_costs import RunningCostSerializer
from expenses.serializers_credits import CreditLogSerializer
from payroll.serializers import AdvanceSerializer, PayrollRunCreateSerializer
from payroll.serializers_upad import PaymentSerializer
from ledger.serializers import ManualJournalEntryCreateSerializer
from ledger.serializers_transactions import TransactionSerializer
from ledger.models import Side
from workforce.models import Employee


@pytest.mark.django_db
class TestSerializerValidations:

    def setup_method(self):
        self.org = Organization.objects.create(name="Validation Org")
        self.employee = Employee.objects.create(
            organization=self.org,
            full_name="Valid Worker",
            employee_code="EMP-VAL-01",
            daily_rate=Decimal("600.00"),
        )

    def test_user_serializer_rejects_short_password(self):
        serializer = UserSerializer(data={"name": "John Doe", "email": "john@test.com", "password": "123"})
        assert not serializer.is_valid()
        assert "password" in serializer.errors

    def test_user_serializer_rejects_blank_name(self):
        serializer = UserSerializer(data={"name": "", "email": "john@test.com", "password": "password123"})
        assert not serializer.is_valid()
        assert "name" in serializer.errors

    def test_project_serializer_rejects_negative_budget(self):
        serializer = ProjectSerializer(data={
            "name": "Test Site",
            "estimated_budget": "-500.00",
            "start_date": "2026-01-01",
        })
        assert not serializer.is_valid()
        assert "estimated_budget" in serializer.errors

    def test_project_serializer_rejects_inverted_dates(self):
        serializer = ProjectSerializer(data={
            "name": "Test Site",
            "estimated_budget": "100000.00",
            "start_date": "2026-06-01",
            "expected_end_date": "2026-01-01",
        })
        assert not serializer.is_valid()
        assert "expected_end_date" in serializer.errors

    def test_budget_category_serializer_rejects_negative_amount(self):
        serializer = BudgetCategorySerializer(data={"name": "Concrete", "allocated_amount": "-100.00"})
        assert not serializer.is_valid()
        assert "allocated_amount" in serializer.errors

    def test_expense_serializer_rejects_zero_or_negative_amount(self):
        serializer = ExpenseSerializer(data={
            "amount": "0.00",
            "description": "Cement",
            "expense_date": "2026-03-01",
        })
        assert not serializer.is_valid()
        assert "amount" in serializer.errors

    def test_running_cost_serializer_rejects_negative_amount(self):
        serializer = RunningCostSerializer(data={
            "project": 1,
            "amount": "-50.00",
            "date": "2026-03-01",
            "description": "Snacks",
        })
        assert not serializer.is_valid()
        assert "amount" in serializer.errors

    def test_credit_log_serializer_rejects_zero_amount(self):
        serializer = CreditLogSerializer(data={
            "amount": "0.00",
            "transaction_date": "2026-03-01",
            "description": "Funding",
        })
        assert not serializer.is_valid()
        assert "amount" in serializer.errors

    def test_advance_serializer_rejects_zero_amount(self):
        serializer = AdvanceSerializer(data={
            "employee": self.employee.id,
            "project": 1,
            "amount": "0.00",
            "advance_date": "2026-03-01",
            "reason": "Personal",
        })
        assert not serializer.is_valid()
        assert "amount" in serializer.errors

    def test_payroll_run_create_serializer_rejects_inverted_period(self):
        serializer = PayrollRunCreateSerializer(data={
            "project_id": 1,
            "period_start": "2026-03-15",
            "period_end": "2026-03-01",
        })
        assert not serializer.is_valid()
        assert "period_end" in serializer.errors

    def test_upad_payment_serializer_rejects_inverted_dates(self):
        serializer = PaymentSerializer(data={
            "employee": self.employee.id,
            "amount": "1500.00",
            "date_from": "2026-03-20",
            "date_to": "2026-03-10",
            "description": "Upad settlement",
        })
        assert not serializer.is_valid()
        assert "date_to" in serializer.errors

    def test_manual_journal_entry_rejects_unbalanced_entry(self):
        serializer = ManualJournalEntryCreateSerializer(data={
            "date": "2026-03-01",
            "description": "Unbalanced journal test",
            "lines": [
                {"account_code": "1001", "side": Side.DR, "amount": "5000.00"},
                {"account_code": "2001", "side": Side.CR, "amount": "4000.00"},
            ],
        })
        assert not serializer.is_valid()
        assert "non_field_errors" in serializer.errors or len(serializer.errors) > 0

    def test_manual_journal_entry_accepts_balanced_entry(self):
        serializer = ManualJournalEntryCreateSerializer(data={
            "date": "2026-03-01",
            "description": "Balanced journal test",
            "lines": [
                {"account_code": "1001", "side": Side.DR, "amount": "5000.00"},
                {"account_code": "2001", "side": Side.CR, "amount": "5000.00"},
            ],
        })
        assert serializer.is_valid(), serializer.errors

    def test_transaction_serializer_rejects_zero_amount_and_blank_names(self):
        serializer = TransactionSerializer(data={
            "date": "2026-03-01",
            "type": "outgoing",
            "amount": "0.00",
            "payer_name": "",
            "payee_name": "",
        })
        assert not serializer.is_valid()
        assert "amount" in serializer.errors
        assert "payer_name" in serializer.errors
        assert "payee_name" in serializer.errors
