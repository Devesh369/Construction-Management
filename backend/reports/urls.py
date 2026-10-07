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
    path("payroll/pdf/", ReportPayrollPDFView.as_view(), name="report-payroll-pdf-slash"),
    path("dpr/excel", ReportDPRExcelView.as_view(), name="report-dpr-excel"),
    path("dpr/excel/", ReportDPRExcelView.as_view(), name="report-dpr-excel-slash"),
    path("expenses/excel", ReportExpensesExcelView.as_view(), name="report-expenses-excel"),
    path("expenses/excel/", ReportExpensesExcelView.as_view(), name="report-expenses-excel-slash"),
    path("profit-loss/pdf", ReportProfitLossPDFView.as_view(), name="report-profit-loss-pdf"),
    path(
        "profit-loss/pdf/", ReportProfitLossPDFView.as_view(), name="report-profit-loss-pdf-slash"
    ),
    path("attendance/excel", ReportAttendanceExcelView.as_view(), name="report-attendance-excel"),
    path(
        "attendance/excel/",
        ReportAttendanceExcelView.as_view(),
        name="report-attendance-excel-slash",
    ),
    path("trial-balance/pdf", ReportTrialBalancePDFView.as_view(), name="report-trial-balance-pdf"),
    path(
        "trial-balance/pdf/",
        ReportTrialBalancePDFView.as_view(),
        name="report-trial-balance-pdf-slash",
    ),
]
