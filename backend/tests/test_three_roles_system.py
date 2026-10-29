"""
Integration tests verifying the 3-role system:
1. Org Admin (Full access to all modules, sole authority to approve payments)
2. Site Manager (Attendance, employees, estimation, work management, expenses, payments creation - blocked from approving payments)
3. Employee / Labour (Strictly read-only access to own attendance, payroll vouchers, and wage payments)
"""

from datetime import date
from decimal import Decimal
import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.services import accept_invitation, create_organization, create_user_invitation
from attendance.models import Attendance, AttendanceStatus
from core.roles import Role
from payroll.models import Payment, PaymentLifecycleStatus
from projects.services import add_project_member, create_project
from workforce.models import Employee, EmploymentType


@pytest.mark.django_db
class TestThreeRolesSystem:
    def setup_method(self):
        self.client = APIClient()

        # 1. Organization & Admin
        self.org, _, tok_admin = create_organization("Mega Build Corp", "admin@megabuild.test")
        self.admin, _ = accept_invitation(tok_admin, "AdminPass123#", "Admin Boss")

        # 2. Site Manager
        _, tok_sm = create_user_invitation(self.org, "sm@megabuild.test", Role.SITE_MANAGER, self.admin)
        self.site_manager, _ = accept_invitation(tok_sm, "SmPass123#", "Site Manager John")

        # 3. Employee / Labour
        _, tok_emp = create_user_invitation(self.org, "worker@megabuild.test", Role.EMPLOYEE, self.admin)
        self.worker_user, _ = accept_invitation(tok_emp, "WorkerPass123#", "Worker Raju")
        self.worker_user.phone = "9876543210"
        self.worker_user.save()

        # Project
        self.project = create_project(
            self.org,
            self.admin,
            {"name": "Skyline Project", "code": "SKY-01", "estimated_budget": Decimal("1000000.00")},
        )
        add_project_member(self.project, self.site_manager, site_role="Site Manager")

        # Link Worker record
        self.worker_record = Employee.objects.create(
            organization=self.org,
            employee_code="EMP-0099",
            full_name="Worker Raju",
            phone="9876543210",
            email="worker@megabuild.test",
            daily_rate=Decimal("900.00"),
            employment_type=EmploymentType.DAILY_WAGE,
            primary_project=self.project,
        )

    def test_site_manager_capabilities(self):
        """Site Manager can take attendance, add employee, work management, expenses, and add payments."""
        self.client.force_authenticate(user=self.site_manager)

        # 1. Take Attendance (check-in)
        att_res = self.client.post(
            "/api/v1/attendance/check-in",
            {
                "employee_id": self.worker_record.id,
                "project_id": self.project.id,
            },
            format="json",
        )
        assert att_res.status_code == status.HTTP_201_CREATED

        # 2. Add Employee
        emp_res = self.client.post(
            "/api/v1/employees",
            {
                "full_name": "New Worker By SM",
                "trade": "CARPENTER",
                "daily_rate": "850.00",
                "employment_type": "DAILY_WAGE",
            },
            format="json",
        )
        assert emp_res.status_code == status.HTTP_201_CREATED
        new_emp_id = emp_res.data["id"]

        # 3. Add Expense
        exp_res = self.client.post(
            "/api/v1/expenses",
            {
                "project": self.project.id,
                "amount": "450.00",
                "expense_date": str(date.today()),
                "category": "PETTY_CASH",
                "description": "Site tea & snacks",
                "payment_mode": "CASH",
            },
            format="json",
        )
        assert exp_res.status_code == status.HTTP_201_CREATED

        # 4. Work Management (Work Entry)
        work_res = self.client.post(
            "/api/v1/work-entries",
            {
                "project": self.project.id,
                "date": str(date.today()),
                "department": "Civil",
                "description": "Foundation reinforcement",
                "employee_ids": [self.worker_record.id],
            },
            format="json",
        )
        assert work_res.status_code == status.HTTP_201_CREATED

        # 5. Add Payment (Must be created as PENDING for Org Admin approval)
        pay_res = self.client.post(
            "/api/v1/payroll/payments",
            {
                "employee": self.worker_record.id,
                "project": self.project.id,
                "amount": "500.00",
                "method": "cash",
                "type": "advance",
                "status": "paid",  # SM tries to mark paid
            },
            format="json",
        )
        assert pay_res.status_code == status.HTTP_201_CREATED
        pay_id = pay_res.data["id"]
        # Forced to PENDING because only Org Admin can approve/confirm
        assert pay_res.data["status"] == "pending"

        # 6. Site Manager CANNOT approve payments (403 Forbidden)
        appr_res = self.client.patch(f"/api/v1/payroll/payments/{pay_id}/approve")
        assert appr_res.status_code == status.HTTP_403_FORBIDDEN

        # Also direct PATCH to status=paid is blocked for SM
        patch_res = self.client.patch(
            f"/api/v1/payroll/payments/{pay_id}",
            {"status": "paid"},
            format="json",
        )
        assert patch_res.status_code == status.HTTP_403_FORBIDDEN

    def test_org_admin_approves_payment(self):
        """Org Admin alone can approve payments created by Site Manager."""
        # 1. Site Manager creates payment
        self.client.force_authenticate(user=self.site_manager)
        pay_res = self.client.post(
            "/api/v1/payroll/payments",
            {
                "employee": self.worker_record.id,
                "project": self.project.id,
                "amount": "700.00",
                "method": "cash",
                "type": "advance",
            },
            format="json",
        )
        assert pay_res.status_code == status.HTTP_201_CREATED
        pay_id = pay_res.data["id"]
        assert pay_res.data["status"] == "pending"

        # 2. Org Admin approves payment
        self.client.force_authenticate(user=self.admin)
        appr_res = self.client.patch(f"/api/v1/payroll/payments/{pay_id}/approve")
        assert appr_res.status_code == status.HTTP_200_OK
        assert appr_res.data["status"] == "approved"

    def test_employee_labour_read_only_access(self):
        """Employee/labour can only read attendance, payroll vouchers, and wages; cannot modify anything."""
        # Create an attendance record for worker
        Attendance.objects.create(
            organization=self.org,
            project=self.project,
            employee=self.worker_record,
            date=date.today(),
            status=AttendanceStatus.PRESENT,
            marked_by=self.site_manager,
        )

        # Create an approved payment for worker
        Payment.objects.create(
            organization=self.org,
            project=self.project,
            employee=self.worker_record,
            amount=Decimal("500.00"),
            status=PaymentLifecycleStatus.PAID,
            created_by=self.admin,
        )

        self.client.force_authenticate(user=self.worker_user)

        # 1. READ attendance -> 200 OK (returns own records)
        att_get = self.client.get("/api/v1/attendance")
        assert att_get.status_code == status.HTTP_200_OK
        assert len(att_get.data["results"]) == 1

        # 2. CANNOT take attendance -> 403 Forbidden
        att_post = self.client.post(
            "/api/v1/attendance/check-in",
            {"employee_id": self.worker_record.id, "project_id": self.project.id},
            format="json",
        )
        assert att_post.status_code == status.HTTP_403_FORBIDDEN

        # 3. READ wages / payments -> 200 OK (returns own payment)
        pay_get = self.client.get("/api/v1/payroll/payments")
        assert pay_get.status_code == status.HTTP_200_OK
        assert len(pay_get.data["results"]) == 1

        # 4. CANNOT create payment -> 403 Forbidden
        pay_post = self.client.post(
            "/api/v1/payroll/payments",
            {"employee": self.worker_record.id, "amount": "100.00"},
            format="json",
        )
        assert pay_post.status_code == status.HTTP_403_FORBIDDEN

        # 5. CANNOT add employee -> 403 Forbidden
        emp_post = self.client.post(
            "/api/v1/employees",
            {"full_name": "Unauthorized Worker"},
            format="json",
        )
        assert emp_post.status_code == status.HTTP_403_FORBIDDEN

        # 6. CANNOT add expenses -> 403 Forbidden
        exp_post = self.client.post(
            "/api/v1/expenses",
            {"amount": "100.00", "description": "Coffee"},
            format="json",
        )
        assert exp_post.status_code == status.HTTP_403_FORBIDDEN

        # 7. CANNOT add work entries -> 403 Forbidden
        work_post = self.client.post(
            "/api/v1/work-entries",
            {"description": "Work"},
            format="json",
        )
        assert work_post.status_code == status.HTTP_403_FORBIDDEN
