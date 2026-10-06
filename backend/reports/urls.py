from django.urls import path

from reports.views import (
    ReportAttendanceExcelView,
    ReportDPRExcelView,
    ReportExpensesExcelView,
    ReportPayrollPDFView,
    ReportProfitLossPDFView,
    ReportTrialBalancePDFView,
)

urlpatterns = [
    path("payroll/pdf", ReportPayrollPDFView.as_view(), name="report-payroll-pdf"),
    path("dpr/excel", ReportDPRExcelView.as_view(), name="report-dpr-excel"),
    path("expenses/excel", ReportExpensesExcelView.as_view(), name="report-expenses-excel"),
    path("profit-loss/pdf", ReportProfitLossPDFView.as_view(), name="report-profit-loss-pdf"),
    path("attendance/excel", ReportAttendanceExcelView.as_view(), name="report-attendance-excel"),
    path("trial-balance/pdf", ReportTrialBalancePDFView.as_view(), name="report-trial-balance-pdf"),
]
