from django.urls import include, path
from rest_framework.routers import DefaultRouter

from payroll.views import AdvanceViewSet, PayrollRunViewSet, PayrollVoucherViewSet

router = DefaultRouter()
router.register(r"advances", AdvanceViewSet, basename="payroll-advances")
router.register(r"runs", PayrollRunViewSet, basename="payroll-runs")
router.register(r"vouchers", PayrollVoucherViewSet, basename="payroll-vouchers")

urlpatterns = [
    path("", include(router.urls)),
]
