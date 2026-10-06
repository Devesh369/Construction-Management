from django.urls import include, path
from rest_framework.routers import DefaultRouter

from expenses.views import ExpenseViewSet, RunningCostBaselineViewSet, VendorViewSet

router = DefaultRouter(trailing_slash=False)
router.register(r"expenses", ExpenseViewSet, basename="expenses")
router.register(r"vendors", VendorViewSet, basename="vendors")
router.register(
    r"running-cost-baselines", RunningCostBaselineViewSet, basename="running-cost-baselines"
)

urlpatterns = [
    path("", include(router.urls)),
]
