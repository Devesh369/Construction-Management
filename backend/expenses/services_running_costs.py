"""
Running Costs Module Services: Site Operational Expenses and Credit-Gating.
Directly implements Section 3 of Module Architecture & Workflow Specification.
"""

import logging
from decimal import Decimal

from core.exceptions import BusinessRuleError
from django.db import transaction
from django.utils import timezone
from projects.models import Project

from expenses.models import PaymentMode, RunningCost

logger = logging.getLogger(__name__)


class RunningCostService:
    @staticmethod
    @transaction.atomic
    def create_running_cost(data: dict, user, organization) -> RunningCost:
        """
        Step-by-step Running Cost creation (Section 3.4 A):
        1. Form fields: project, date, amount, description, paymentMethod.
        2. If paymentMethod == 'cash': CreditLogsService.deductCredit() called.
        3. If insufficient credit balance, exception thrown - cost is NOT recorded.
        4. RunningCost document created with user ID, name, and role.
        """
        project_id = data.get("project_id") or data.get("project")
        project = Project.objects.filter(id=project_id, organization=organization).first()
        if not project:
            raise BusinessRuleError("Project not found.", code="project_not_found")

        amount = Decimal(str(data.get("amount", "0.00")))
        if amount <= Decimal("0.00"):
            raise BusinessRuleError(
                "Expense amount must be greater than zero.", code="invalid_amount"
            )

        date = data.get("date") or timezone.now().date()
        description = data.get("description", "").strip()
        if not description:
            raise BusinessRuleError(
                "Description is required for site running cost.", code="description_required"
            )

        payment_method = data.get("payment_method") or data.get("paymentMethod") or PaymentMode.CASH

        # 3. Direct recording (Cash Credits module removed)
        # 5. RunningCost document is created with user details
        rc = RunningCost.objects.create(
            organization=organization,
            project=project,
            date=date,
            amount=amount,
            description=description,
            entered_by=user,
            user_name=getattr(user, "name", "") or user.email,
            user_role=getattr(user, "role", "ADMIN"),
            payment_method=payment_method,
        )
        return rc

    @staticmethod
    @transaction.atomic
    def delete_running_cost(running_cost_id: int, user, organization) -> dict:
        """Delete running cost with credit restoration if paid in cash."""
        rc = RunningCost.objects.filter(
            id=running_cost_id, organization=organization, deleted_at__isnull=True
        ).first()

        if not rc:
            raise BusinessRuleError("Running cost record not found.", code="not_found")

        # Direct deletion (Cash credit module removed)
        rc.delete()
        return {"status": "deleted", "id": running_cost_id}

    @staticmethod
    def get_summary(organization, project_id=None, user=None) -> dict:
        """Running costs summary statistics (Section 3.4 B)."""
        qs = RunningCost.objects.filter(organization=organization, deleted_at__isnull=True)
        if project_id:
            qs = qs.filter(project_id=project_id)
        if user and user.role not in ["ORG_ADMIN", "ACCOUNTANT"]:
            qs = qs.filter(entered_by=user)

        total_count = qs.count()
        total_amount = sum((r.amount for r in qs), Decimal("0.00"))
        cash_amount = sum(
            (r.amount for r in qs.filter(payment_method__iexact="cash")), Decimal("0.00")
        )
        other_amount = total_amount - cash_amount

        return {
            "total_count": total_count,
            "total_amount": float(total_amount),
            "cash_amount": float(cash_amount),
            "non_cash_amount": float(other_amount),
        }
