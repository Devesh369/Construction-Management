"""
Views for UPAD Payments Module.
Directly implements Section 1.3, 1.4, and 1.5 of Module Architecture & Workflow Specification.
"""

from decimal import Decimal
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsTenantUser, roles_required
from core.roles import Role
from core.views import TenantViewSet
from core.exceptions import BusinessRuleError
from payroll.models import Payment, PaymentLifecycleStatus
from payroll.serializers_upad import PaymentSerializer
from payroll.services_upad import UpadPaymentService
from attendance.services_settlement import AttendanceSettlementService
from workforce.models import Employee


class PaymentViewSet(TenantViewSet):
    """
    UPAD Module Endpoints (Advance Payments, Salary Disbursements, and Approvals).
    """
    queryset = Payment.objects.all().select_related("employee", "project", "created_by", "approved_by", "processed_by")
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, IsTenantUser]

    def get_queryset(self):
        qs = super().get_queryset()
        emp_id = self.request.query_params.get("employee")
        proj_id = self.request.query_params.get("project")
        pay_type = self.request.query_params.get("type")
        status_filter = self.request.query_params.get("status")
        method = self.request.query_params.get("method")
        from_date = self.request.query_params.get("from_date") or self.request.query_params.get("fromDate")
        to_date = self.request.query_params.get("to_date") or self.request.query_params.get("toDate")

        if emp_id:
            qs = qs.filter(employee_id=emp_id)
        if proj_id:
            qs = qs.filter(project_id=proj_id)
        if pay_type:
            qs = qs.filter(type=pay_type)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if method:
            qs = qs.filter(method=method)
        if from_date:
            qs = qs.filter(created_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(created_at__date__lte=to_date)

        return qs

    def create(self, request, *args, **kwargs):
        """Create a single UPAD payment (Section 1.4 A & B)."""
        payment = UpadPaymentService.create_payment(
            data=request.data,
            user=request.user,
            organization=request.user.organization,
        )
        serializer = self.get_serializer(payment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="batch")
    def batch(self, request):
        """Create batch/group payments (Section 1.4 C)."""
        payments_data = request.data.get("payments", [])
        if not payments_data or not isinstance(payments_data, list):
            return Response({"error": "A list of 'payments' is required."}, status=status.HTTP_400_BAD_REQUEST)

        created = []
        for pdata in payments_data:
            payment = UpadPaymentService.create_payment(
                data=pdata,
                user=request.user,
                organization=request.user.organization,
            )
            created.append(self.get_serializer(payment).data)

        return Response({"created_count": len(created), "payments": created}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Summary statistics for UPAD disbursements."""
        data = UpadPaymentService.get_summary(
            organization=request.user.organization,
            user=request.user,
        )
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="calculate-salary")
    def calculate_salary(self, request):
        """Calculate salary for date range based on attendance (Section 1.3)."""
        employee_id = request.query_params.get("employee_id") or request.query_params.get("employee")
        from_date = request.query_params.get("from_date") or request.query_params.get("fromDate")
        to_date = request.query_params.get("to_date") or request.query_params.get("toDate")

        if not employee_id:
            return Response({"error": "employee_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not from_date or not to_date:
            return Response({"error": "from_date and to_date are required"}, status=status.HTTP_400_BAD_REQUEST)

        emp = Employee.objects.filter(id=employee_id, organization=request.user.organization).first()
        if not emp:
            return Response({"error": "Employee not found"}, status=status.HTTP_404_NOT_FOUND)

        calc = AttendanceSettlementService.calculate_salary_for_range(emp, from_date, to_date)
        return Response(calc, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="remaining-salary")
    def remaining_salary(self, request):
        """Get remaining salary per employee (Section 1.3)."""
        employee_id = request.query_params.get("employee_id") or request.query_params.get("employee")
        if employee_id:
            emp = Employee.objects.filter(id=employee_id, organization=request.user.organization).first()
            if not emp:
                return Response({"error": "Employee not found"}, status=status.HTTP_404_NOT_FOUND)
            res = AttendanceSettlementService.get_remaining_salary(emp)
            return Response(res, status=status.HTTP_200_OK)

        # Bulk list for all active employees
        employees = Employee.objects.filter(organization=request.user.organization, deleted_at__isnull=True)
        results = [AttendanceSettlementService.get_remaining_salary(e) for e in employees]
        return Response(results, status=status.HTTP_200_OK)

    @action(detail=True, methods=["patch"], url_path="approve")
    def approve(self, request, pk=None):
        """Approve a pending payment (Section 1.4 B)."""
        payment = UpadPaymentService.approve_payment(
            payment_id=pk,
            user=request.user,
            organization=request.user.organization,
        )
        return Response(self.get_serializer(payment).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["patch"], url_path="reject")
    def reject(self, request, pk=None):
        """Reject a pending payment (Section 1.4 B)."""
        reason = request.data.get("reason", "")
        payment = UpadPaymentService.reject_payment(
            payment_id=pk,
            user=request.user,
            organization=request.user.organization,
            reason=reason,
        )
        return Response(self.get_serializer(payment).data, status=status.HTTP_200_OK)

    def partial_update(self, request, *args, **kwargs):
        payment = self.get_object()
        new_status = (request.data.get("status") or "").lower().strip()
        user = request.user
        org = user.organization

        if new_status:
            if new_status in ["paid", "confirmed"]:
                if payment.status != PaymentLifecycleStatus.PAID:
                    payment = UpadPaymentService.process_payment(payment.id, user, org)
            elif new_status == "approved":
                if payment.status != PaymentLifecycleStatus.APPROVED:
                    payment = UpadPaymentService.approve_payment(payment.id, user, org)
            elif new_status == "rejected":
                reason = request.data.get("reason", "Status changed to rejected")
                payment = UpadPaymentService.reject_payment(payment.id, user, org, reason)
            elif new_status == "pending":
                if payment.status == PaymentLifecycleStatus.PAID:
                    AttendanceSettlementService.reverse_settlement_by_payment_id(str(payment.id))
                    from ledger.models import Transaction
                    if payment.transaction_id:
                        Transaction.objects.filter(transaction_id=payment.transaction_id, organization=org).update(status="pending")
                payment.status = PaymentLifecycleStatus.PENDING
                payment.save()
            return Response(self.get_serializer(payment).data, status=status.HTTP_200_OK)

        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """Delete a payment with full reversal (Section 1.4 D)."""
        res = UpadPaymentService.delete_payment(
            payment_id=kwargs.get("pk"),
            user=request.user,
            organization=request.user.organization,
        )
        return Response(res, status=status.HTTP_200_OK)
