"""
Reports generation API views.
Exports PDF documents (ReportLab) and Excel spreadsheets (openpyxl) on-demand.
Layer 7: Read-only consumer.
"""

from audit.constants import AuditAction
from audit.services import log_action
from core.permissions import IsTenantUser, roles_required
from core.roles import Role
from django.http import HttpResponse
from projects.services import user_project_ids
from rest_framework import views
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated

from reports.services import (
    generate_attendance_excel,
    generate_dpr_excel,
    generate_expenses_excel,
    generate_payroll_pdf,
    generate_profit_loss_pdf,
    generate_trial_balance_pdf,
)


class BaseReportView(views.APIView):
    """Base class for report views to extract parameters and check project scoping."""

    def get_param(self, request, key, default=None):
        return request.query_params.get(key) or (
            request.data.get(key, default) if isinstance(request.data, dict) else default
        )

    def resolve_project_scope(self, request, project_id=None):
        """
        Validate project scoping for site roles.
        Returns:
            (resolved_project_id, allowed_pids)
        """
        user = request.user
        if user.role in [Role.ORG_ADMIN, Role.ACCOUNTANT]:
            return project_id, None

        allowed_pids = user_project_ids(user)
        if project_id:
            try:
                pid = int(project_id)
            except (ValueError, TypeError):
                pid = None
            if pid not in allowed_pids:
                raise PermissionDenied("You are not assigned to this project.")
            return pid, None
        return None, allowed_pids


class ReportPayrollPDFView(BaseReportView):
    """
    POST / GET /api/v1/reports/payroll/pdf
    Roles: ACCOUNTANT, ORG_ADMIN
    Body/Params: {project_id?, period_start?, period_end?}
    """

    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ACCOUNTANT, Role.ORG_ADMIN),
    ]

    def handle_request(self, request):
        project_id = self.get_param(request, "project_id")
        period_start = self.get_param(request, "period_start")
        period_end = self.get_param(request, "period_end")

        proj_id, allowed_pids = self.resolve_project_scope(request, project_id)

        buffer, row_count = generate_payroll_pdf(
            org=request.user.organization,
            user=request.user,
            project_id=proj_id,
            period_start=period_start,
            period_end=period_end,
            allowed_pids=allowed_pids,
        )

        log_action(
            user=request.user,
            action=AuditAction.REPORT_EXPORTED,
            organization=request.user.organization,
            request=request,
            metadata={
                "report_type": "payroll_pdf",
                "format": "pdf",
                "row_count": row_count,
                "project_id": proj_id,
            },
        )

        response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = 'attachment; filename="payroll_report.pdf"'
        return response

    def post(self, request):
        return self.handle_request(request)

    def get(self, request):
        return self.handle_request(request)


class ReportDPRExcelView(BaseReportView):
    """
    POST / GET /api/v1/reports/dpr/excel
    Roles: PROJECT_MANAGER, ORG_ADMIN
    Body/Params: {project_id?, date_from?, date_to?}
    """

    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.PROJECT_MANAGER, Role.ORG_ADMIN),
    ]

    def handle_request(self, request):
        project_id = self.get_param(request, "project_id")
        date_from = self.get_param(request, "date_from")
        date_to = self.get_param(request, "date_to")

        proj_id, allowed_pids = self.resolve_project_scope(request, project_id)

        buffer, row_count = generate_dpr_excel(
            org=request.user.organization,
            user=request.user,
            project_id=proj_id,
            date_from=date_from,
            date_to=date_to,
            allowed_pids=allowed_pids,
        )

        log_action(
            user=request.user,
            action=AuditAction.REPORT_EXPORTED,
            organization=request.user.organization,
            request=request,
            metadata={
                "report_type": "dpr_excel",
                "format": "excel",
                "row_count": row_count,
                "project_id": proj_id,
            },
        )

        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="dpr_report.xlsx"'
        return response

    def post(self, request):
        return self.handle_request(request)

    def get(self, request):
        return self.handle_request(request)


class ReportExpensesExcelView(BaseReportView):
    """
    POST / GET /api/v1/reports/expenses/excel
    Roles: ACCOUNTANT, ORG_ADMIN, PROJECT_MANAGER
    Body/Params: {project_id?, date_from?, date_to?, category?, status?}
    """

    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ACCOUNTANT, Role.ORG_ADMIN, Role.PROJECT_MANAGER),
    ]

    def handle_request(self, request):
        project_id = self.get_param(request, "project_id")
        date_from = self.get_param(request, "date_from")
        date_to = self.get_param(request, "date_to")
        category = self.get_param(request, "category")
        status_filter = self.get_param(request, "status")

        proj_id, allowed_pids = self.resolve_project_scope(request, project_id)

        buffer, row_count = generate_expenses_excel(
            org=request.user.organization,
            user=request.user,
            project_id=proj_id,
            date_from=date_from,
            date_to=date_to,
            category=category,
            status=status_filter,
            allowed_pids=allowed_pids,
        )

        log_action(
            user=request.user,
            action=AuditAction.REPORT_EXPORTED,
            organization=request.user.organization,
            request=request,
            metadata={
                "report_type": "expenses_excel",
                "format": "excel",
                "row_count": row_count,
                "project_id": proj_id,
                "category": category,
            },
        )

        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="expenses_report.xlsx"'
        return response

    def post(self, request):
        return self.handle_request(request)

    def get(self, request):
        return self.handle_request(request)


class ReportProfitLossPDFView(BaseReportView):
    """
    POST / GET /api/v1/reports/profit-loss/pdf
    Roles: ACCOUNTANT, ORG_ADMIN
    Body/Params: {date_from?, date_to?, project_id?}
    """

    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ACCOUNTANT, Role.ORG_ADMIN),
    ]

    def handle_request(self, request):
        project_id = self.get_param(request, "project_id")
        date_from = self.get_param(request, "date_from")
        date_to = self.get_param(request, "date_to")

        proj_id, _ = self.resolve_project_scope(request, project_id)

        buffer, row_count = generate_profit_loss_pdf(
            org=request.user.organization,
            user=request.user,
            date_from=date_from,
            date_to=date_to,
            project_id=proj_id,
        )

        log_action(
            user=request.user,
            action=AuditAction.REPORT_EXPORTED,
            organization=request.user.organization,
            request=request,
            metadata={
                "report_type": "profit_loss_pdf",
                "format": "pdf",
                "row_count": row_count,
                "project_id": proj_id,
            },
        )

        response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = 'attachment; filename="profit_loss.pdf"'
        return response

    def post(self, request):
        return self.handle_request(request)

    def get(self, request):
        return self.handle_request(request)


class ReportAttendanceExcelView(BaseReportView):
    """
    POST / GET /api/v1/reports/attendance/excel
    Roles: PROJECT_MANAGER, ORG_ADMIN, ACCOUNTANT
    Body/Params: {project_id?, date_from?, date_to?}
    """

    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.PROJECT_MANAGER, Role.ORG_ADMIN, Role.ACCOUNTANT),
    ]

    def handle_request(self, request):
        project_id = self.get_param(request, "project_id")
        date_from = self.get_param(request, "date_from")
        date_to = self.get_param(request, "date_to")

        proj_id, allowed_pids = self.resolve_project_scope(request, project_id)

        buffer, row_count = generate_attendance_excel(
            org=request.user.organization,
            user=request.user,
            project_id=proj_id,
            date_from=date_from,
            date_to=date_to,
            allowed_pids=allowed_pids,
        )

        log_action(
            user=request.user,
            action=AuditAction.REPORT_EXPORTED,
            organization=request.user.organization,
            request=request,
            metadata={
                "report_type": "attendance_excel",
                "format": "excel",
                "row_count": row_count,
                "project_id": proj_id,
            },
        )

        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="attendance_report.xlsx"'
        return response

    def post(self, request):
        return self.handle_request(request)

    def get(self, request):
        return self.handle_request(request)


class ReportTrialBalancePDFView(BaseReportView):
    """
    POST / GET /api/v1/reports/trial-balance/pdf
    Roles: ACCOUNTANT, ORG_ADMIN
    Body/Params: {as_of?, project_id?}
    """

    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ACCOUNTANT, Role.ORG_ADMIN),
    ]

    def handle_request(self, request):
        project_id = self.get_param(request, "project_id")
        as_of = self.get_param(request, "as_of") or self.get_param(request, "as_of_date")

        proj_id, _ = self.resolve_project_scope(request, project_id)

        buffer, row_count = generate_trial_balance_pdf(
            org=request.user.organization,
            user=request.user,
            as_of=as_of,
            project_id=proj_id,
        )

        log_action(
            user=request.user,
            action=AuditAction.REPORT_EXPORTED,
            organization=request.user.organization,
            request=request,
            metadata={
                "report_type": "trial_balance_pdf",
                "format": "pdf",
                "row_count": row_count,
                "project_id": proj_id,
            },
        )

        response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = 'attachment; filename="trial_balance.pdf"'
        return response

    def post(self, request):
        return self.handle_request(request)

    def get(self, request):
        return self.handle_request(request)
