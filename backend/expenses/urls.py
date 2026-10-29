from django.urls import include, path
from rest_framework.routers import DefaultRouter

from expenses.views import ExpenseViewSet, RunningCostBaselineViewSet, VendorViewSet
from expenses.views_credits import CreditLogViewSet
from expenses.views_running_costs import RunningCostViewSet

router = DefaultRouter(trailing_slash=False)
router.register(r"expenses", ExpenseViewSet, basename="expenses")
router.register(r"vendors", VendorViewSet, basename="vendors")
router.register(
    r"running-cost-baselines", RunningCostBaselineViewSet, basename="running-cost-baselines"
)
router.register(r"running-costs", RunningCostViewSet, basename="running-costs")
router.register(r"credit-logs", CreditLogViewSet, basename="credit-logs")

urlpatterns = [
    path("", include(router.urls)),
]
