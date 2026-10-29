from django.urls import include, path
from rest_framework.routers import DefaultRouter

from payroll.views import AdvanceViewSet, PayrollRunViewSet, PayrollVoucherViewSet
from payroll.views_upad import PaymentViewSet

router = DefaultRouter(trailing_slash=False)
router.register(r"advances", AdvanceViewSet, basename="payroll-advances")
router.register(r"runs", PayrollRunViewSet, basename="payroll-runs")
router.register(r"vouchers", PayrollVoucherViewSet, basename="payroll-vouchers")
router.register(r"payments", PaymentViewSet, basename="upad-payments")

urlpatterns = [
    path("", include(router.urls)),
]
