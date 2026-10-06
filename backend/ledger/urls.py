from django.urls import include, path
from rest_framework.routers import DefaultRouter

from ledger.views import (
    AccountStatementView,
    AccountViewSet,
    BalanceSheetView,
    JournalEntryViewSet,
    ProfitLossView,
    TrialBalanceView,
)

router = DefaultRouter(trailing_slash=False)
router.register(r"accounts", AccountViewSet, basename="ledger-accounts")
router.register(r"entries", JournalEntryViewSet, basename="ledger-entries")

urlpatterns = [
    path("account-statement", AccountStatementView.as_view(), name="ledger-account-statement"),
    path("trial-balance", TrialBalanceView.as_view(), name="ledger-trial-balance"),
    path("profit-loss", ProfitLossView.as_view(), name="ledger-profit-loss"),
    path("balance-sheet", BalanceSheetView.as_view(), name="ledger-balance-sheet"),
    path("", include(router.urls)),
]
