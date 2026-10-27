"""
UPAD Module Services: Worker Advance Payments, Salary Disbursements, and Approvals.
Directly implements Section 1 of Module Architecture & Workflow Specification.
"""

from datetime import timedelta
from decimal import Decimal
import logging
from django.db import transaction
from django.utils import timezone
from core.exceptions import BusinessRuleError
from accounts.models import Role
from payroll.models import Payment, PaymentType, PaymentMethod, PaymentLifecycleStatus
from workforce.models import Employee
from expenses.services_credits import CreditLogsService
from attendance.services_settlement import AttendanceSettlementService
from ledger.services_transactions import TransactionService
from ledger.models import Transaction, TransactionType, TransactionCategory

logger = logging.getLogger(__name__)


class UpadPaymentService:
    @staticmethod
    @transaction.atomic
    def create_payment(data: dict, user, organization) -> Payment:
        """
        Direct and Pending Payment Creation (Section 1.4 A & B):
        - Employee validation
        - 60-second duplicate payment prevention
        - Cash credit gating
        - Linked transaction creation
        - Attendance settlement
        """
        employee_id = data.get("employee_id") or data.get("employee")
        employee = Employee.objects.filter(id=employee_id, organization=organization).first()
        if not employee:
            raise BusinessRuleError("Employee not found.", code="employee_not_found")

        amount = Decimal(str(data.get("amount", "0.00")))
        if amount <= Decimal("0.00"):
            raise BusinessRuleError("Payment amount must be greater than zero.", code="invalid_amount")

        # 4. Duplicate detection: checks if same employee + same amount was paid in last 60 seconds
        sixty_secs_ago = timezone.now() - timedelta(seconds=60)
        recent_duplicate = Payment.objects.filter(
            organization=organization,
            employee=employee,
            amount=amount,
            created_at__gte=sixty_secs_ago,
            deleted_at__isnull=True,
        ).exists()
        if recent_duplicate:
            raise BusinessRuleError(
                f"Duplicate payment detected! A payment of ₹{amount:,.2f} to {employee.full_name} was already submitted in the last 60 seconds.",
                code="duplicate_payment_detected",
            )

        pay_type = data.get("type", PaymentType.ADVANCE)
        if pay_type == PaymentType.SALARY:
            from attendance.models import Attendance, AttendanceStatus
            has_attendance = Attendance.objects.filter(
                employee=employee,
                status__in=[AttendanceStatus.PRESENT, AttendanceStatus.HALF_DAY, AttendanceStatus.HOLIDAY],
                deleted_at__isnull=True,
            ).exists()
            if not has_attendance:
                raise BusinessRuleError(
                    "Cannot disburse wages to an employee with no marked attendance. Attendance must be recorded first.",
                    code="attendance_required",
                )
        method = data.get("method", PaymentMethod.CASH)
        initial_status = data.get("status", PaymentLifecycleStatus.PAID)
        base_salary = Decimal(str(data.get("base_salary") or data.get("baseSalary") or amount))
        expenses = Decimal(str(data.get("expenses", "0.00")))
        date_from = data.get("date_from") or (data.get("dateRange", {}).get("from") if isinstance(data.get("dateRange"), dict) else None)
        date_to = data.get("date_to") or (data.get("dateRange", {}).get("to") if isinstance(data.get("dateRange"), dict) else None)
        description = data.get("description", "")
        project_id = data.get("project_id") or data.get("project")

        payment = Payment(
            organization=organization,
            employee=employee,
            project_id=project_id,
            type=pay_type,
            base_salary=base_salary,
            expenses=expenses,
            amount=amount,
            method=method,
            status=initial_status,
            date_from=date_from,
            date_to=date_to,
            description=description,
            created_by=user,
        )

        txn_id = TransactionService.generate_transaction_id()
        payment.transaction_id = txn_id

        # If status is immediately PAID:
        if initial_status == PaymentLifecycleStatus.PAID:
            payment.processed_by = user
            payment.processed_at = timezone.now()

            # 5. Direct cash payment recording (Cash Credits module removed)
            payment.save()

            # 7. Settle attendance records
            AttendanceSettlementService.settle_by_payment_amount(
                employee=employee,
                payment_amount=amount,
                payment_id=str(payment.id),
            )

            # 8. Create Transaction in central ledger
            Transaction.objects.create(
                organization=organization,
                transaction_id=txn_id,
                date=timezone.now().date(),
                type=TransactionType.OUTGOING,
                category=TransactionCategory.SALARY,
                payer_name=organization.name,
                payee_name=employee.full_name,
                amount=amount,
                method=method,
                status="completed",
                description=f"UPAD ({pay_type.title()}): {description or employee.full_name}",
                recorded_by=user,
                metadata={
                    "source": "upad",
                    "paymentId": payment.id,
                    "employeeId": employee.id,
                    "paymentType": pay_type,
                },
            )

            # 9. Sync into Advance model so worker balance and payroll runs reflect it immediately
            if pay_type in [PaymentType.ADVANCE, PaymentType.WITHDRAWAL] and not description.startswith("[ADV-"):
                try:
                    from payroll.models import Advance, AdvanceStatus
                    from projects.models import Project
                    proj = payment.project or employee.primary_project or employee.assigned_projects.first()
                    if not proj:
                        proj = Project.objects.filter(organization=organization).first()
                    if proj:
                        Advance.objects.create(
                            organization=organization,
                            employee=employee,
                            project=proj,
                            amount=amount,
                            advance_date=date_from or timezone.now().date(),
                            reason=f"[UPAD-{payment.id}] {description}".strip(),
                            payment_mode=method.upper(),
                            given_by=user,
                            status=AdvanceStatus.OPEN,
                        )
                except Exception:
                    pass
        else:
            payment.save()

        return payment

    @staticmethod
    @transaction.atomic
    def approve_payment(payment_id: int, user, organization) -> Payment:
        """
        Approval workflow (Section 1.4 B):
        - Self-approval check: approver != creator (separation of duties)
        - Status changes from PENDING to APPROVED
        """
        payment = Payment.objects.select_for_update().filter(
            id=payment_id, organization=organization, deleted_at__isnull=True
        ).first()

        if not payment:
            raise BusinessRuleError("Payment not found.", code="payment_not_found")

        if payment.status != PaymentLifecycleStatus.PENDING:
            raise BusinessRuleError(f"Only PENDING payments can be approved. Current status: {payment.status}", code="invalid_status")

        # 3. Self-approval check: approver != creator (separation of duties)
        if payment.created_by_id == user.id and not getattr(user, "is_superuser", False):
            raise BusinessRuleError(
                "Self-approval is forbidden. A different administrator or manager must approve this payment.",
                code="self_approval_forbidden",
            )

        payment.status = PaymentLifecycleStatus.APPROVED
        payment.approved_by = user
        payment.approved_by_admin_name = getattr(user, "name", "") or user.email
        payment.approved_at = timezone.now()
        payment.save()
        return payment

    @staticmethod
    @transaction.atomic
    def reject_payment(payment_id: int, user, organization, reason: str = "") -> Payment:
        """Reject a pending payment."""
        payment = Payment.objects.select_for_update().filter(
            id=payment_id, organization=organization, deleted_at__isnull=True
        ).first()

        if not payment:
            raise BusinessRuleError("Payment not found.", code="payment_not_found")

        if payment.status != PaymentLifecycleStatus.PENDING:
            raise BusinessRuleError("Only PENDING payments can be rejected.", code="invalid_status")

        payment.status = PaymentLifecycleStatus.REJECTED
        if reason:
            payment.description = f"{payment.description} [Rejected: {reason}]".strip()
        payment.save()
        return payment

    @staticmethod
    @transaction.atomic
    def process_payment(payment_id: int, user, organization) -> Payment:
        """
        Process (mark paid/confirmed) a payment:
        - Validates payment is PENDING or APPROVED
        - Marks status -> PAID
        - Settles attendance records
        - Creates linked Transaction in Payment Central
        """
        payment = Payment.objects.select_for_update().filter(
            id=payment_id, organization=organization, deleted_at__isnull=True
        ).first()

        if not payment:
            raise BusinessRuleError("Payment not found.", code="payment_not_found")

        if payment.status not in [PaymentLifecycleStatus.APPROVED, PaymentLifecycleStatus.PENDING]:
            raise BusinessRuleError("Only PENDING or APPROVED payments can be processed for disbursement.", code="payment_not_approved")

        txn_id = payment.transaction_id or TransactionService.generate_transaction_id()
        payment.transaction_id = txn_id

        payment.status = PaymentLifecycleStatus.PAID
        payment.approved_by = payment.approved_by or user
        payment.approved_at = payment.approved_at or timezone.now()
        payment.approved_by_admin_name = payment.approved_by_admin_name or getattr(user, "name", "") or user.email
        payment.processed_by = user
        payment.processed_at = timezone.now()
        payment.save()

        # Attendance settlement
        AttendanceSettlementService.settle_by_payment_amount(
            employee=payment.employee,
            payment_amount=payment.amount,
            payment_id=str(payment.id),
        )

        # Create linked Transaction
        Transaction.objects.create(
            organization=organization,
            transaction_id=txn_id,
            date=timezone.now().date(),
            type=TransactionType.OUTGOING,
            category=TransactionCategory.SALARY,
            payer_name=organization.name,
            payee_name=payment.employee.full_name,
            amount=payment.amount,
            method=payment.method,
            status="completed",
            description=f"UPAD ({payment.type.title()}): {payment.description or payment.employee.full_name}",
            recorded_by=user,
            metadata={
                "source": "upad",
                "paymentId": payment.id,
                "employeeId": payment.employee_id,
                "paymentType": payment.type,
            },
        )

        # Sync into Advance model if not already synced
        if payment.type in [PaymentType.ADVANCE, PaymentType.WITHDRAWAL] and not payment.description.startswith("[ADV-"):
            try:
                from payroll.models import Advance, AdvanceStatus
                from projects.models import Project
                if not Advance.objects.filter(reason__contains=f"[UPAD-{payment.id}]").exists():
                    proj = payment.project or payment.employee.primary_project or payment.employee.assigned_projects.first()
                    if not proj:
                        proj = Project.objects.filter(organization=organization).first()
                    if proj:
                        Advance.objects.create(
                            organization=organization,
                            employee=payment.employee,
                            project=proj,
                            amount=payment.amount,
                            advance_date=payment.date_from or timezone.now().date(),
                            reason=f"[UPAD-{payment.id}] {payment.description}".strip(),
                            payment_mode=payment.method.upper(),
                            given_by=user,
                            status=AdvanceStatus.OPEN,
                        )
            except Exception:
                pass

        return payment

    @staticmethod
    @transaction.atomic
    def delete_payment(payment_id: int, user, organization) -> dict:
        """
        Payment Deletion / Full Reversal (Section 1.4 D):
        1. Reverse attendance settlements.
        2. Delete linked Advance.
        3. Delete linked Transaction.
        4. Delete Payment document.
        """
        payment = Payment.objects.filter(
            id=payment_id, organization=organization, deleted_at__isnull=True
        ).first()

        if not payment:
            raise BusinessRuleError("Payment not found.", code="payment_not_found")

        # 1. Reverse attendance settlements
        AttendanceSettlementService.reverse_settlement_by_payment_id(str(payment.id))

        # 2. Delete linked Advance if created by this payment
        from payroll.models import Advance
        Advance.objects.filter(
            organization=organization,
            reason__contains=f"[UPAD-{payment.id}]",
        ).delete()

        # 3. Delete linked transaction
        if payment.transaction_id:
            Transaction.objects.filter(
                organization=organization,
                transaction_id=payment.transaction_id,
            ).delete()

        # 4. Delete payment
        payment.delete()
        return {"status": "reversed_and_deleted", "payment_id": payment_id}

    @staticmethod
    def get_summary(organization, user=None) -> dict:
        """Payment summary statistics (Section 1.3)."""
        qs = Payment.objects.filter(organization=organization, deleted_at__isnull=True)
        total_payments = qs.count()
        paid_qs = qs.filter(status=PaymentLifecycleStatus.PAID)
        pending_qs = qs.filter(status=PaymentLifecycleStatus.PENDING)

        total_disbursed = sum((p.amount for p in paid_qs), Decimal("0.00"))
        total_pending = sum((p.amount for p in pending_qs), Decimal("0.00"))
        salary_sum = sum((p.amount for p in paid_qs.filter(type=PaymentType.SALARY)), Decimal("0.00"))
        advance_sum = sum((p.amount for p in paid_qs.filter(type=PaymentType.ADVANCE)), Decimal("0.00"))
        withdrawal_sum = sum((p.amount for p in paid_qs.filter(type=PaymentType.WITHDRAWAL)), Decimal("0.00"))

        return {
            "total_count": total_payments,
            "total_disbursed": float(total_disbursed),
            "total_pending": float(total_pending),
            "salary_total": float(salary_sum),
            "advance_total": float(advance_sum),
            "withdrawal_total": float(withdrawal_sum),
        }
