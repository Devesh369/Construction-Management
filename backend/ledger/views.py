"""
Ledger views: Chart of accounts, journal entries, and financial statements.
Enforces multi-tenancy, immutable audit logging, and accounting rules.
"""

from decimal import Decimal

from rest_framework import status, views, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from audit.constants import AuditAction
from audit.services import log_action
from core.exceptions import BusinessRuleError
from core.permissions import IsTenantUser, roles_required
from core.roles import Role
from core.views import TenantViewSet
from ledger.filters import JournalEntryFilter
from ledger.models import Account, JournalEntry, ReferenceType
from ledger.serializers import (
    AccountSerializer,
    JournalEntrySerializer,
    ManualJournalEntryCreateSerializer,
    ReverseJournalEntrySerializer,
)
from ledger.services import (
    account_statement,
    balance_sheet,
    get_account_balance,
    post_journal_entry,
    profit_and_loss,
    reconcile_ledger,
    reverse_entry,
    trial_balance,
)
from projects.models import Project


class AccountViewSet(TenantViewSet):
    """
    Chart of accounts viewset.
    List, create custom accounts, or update name/active status.
    Cannot deactivate an account with a non-zero balance.
    """

    queryset = Account.objects.all()
    serializer_class = AccountSerializer
    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ACCOUNTANT, Role.ORG_ADMIN),
    ]
    filterset_fields = ["type", "is_active"]
    search_fields = ["code", "name"]
    ordering = ["code"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Account.objects.none()
        return Account.objects.filter(organization=self.request.user.organization)

    def perform_update(self, serializer):
        instance = serializer.instance
        new_active = serializer.validated_data.get("is_active")

        # Guard: cannot deactivate an account with a non-zero balance
        if new_active is False and instance.is_active is True:
            bal = get_account_balance(instance)
            if bal != Decimal("0.00"):
                raise BusinessRuleError(
                    f"Cannot deactivate account '{instance.code}' with non-zero balance ({bal}).",
                    code="account_has_balance",
                )
        serializer.save()


class JournalEntryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for journal entries with manual posting and reversal actions.
    Entries and lines are immutable.
    """

    queryset = JournalEntry.objects.all()
    serializer_class = JournalEntrySerializer
    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ACCOUNTANT, Role.ORG_ADMIN),
    ]
    filterset_class = JournalEntryFilter
    search_fields = ["entry_number", "description"]
    ordering = ["-date", "-created_at"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return JournalEntry.objects.none()
        return (
            JournalEntry.objects.filter(organization=self.request.user.organization)
            .select_related("project", "posted_by")
            .prefetch_related("lines__account")
        )

    def create(self, request, *args, **kwargs):
        """UC-26: Post a manual double-entry journal transaction."""
        serializer = ManualJournalEntryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        org = request.user.organization
        project = None
        if data.get("project_id"):
            try:
                project = Project.objects.get(organization=org, id=data["project_id"])
            except Project.DoesNotExist:
                raise BusinessRuleError(
                    "Project not found in this organization.", code="project_not_found"
                )

        entry = post_journal_entry(
            org=org,
            date=data["date"],
            description=data["description"],
            lines=data["lines"],
            reference_type=ReferenceType.MANUAL,
            user=request.user,
            project=project,
        )

        log_action(
            user=request.user,
            action=AuditAction.JOURNAL_POSTED_MANUAL,
            obj=entry,
            changes={"entry_number": entry.entry_number, "description": entry.description},
            organization=org,
        )

        return Response(JournalEntrySerializer(entry).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="reverse")
    def reverse(self, request, pk=None):
        """UC-26: Reverse a posted journal entry with mirror lines."""
        entry = self.get_object()
        serializer = ReverseJournalEntrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data["reason"]

        reversal = reverse_entry(entry, user=request.user, reason=reason)
        return Response(JournalEntrySerializer(reversal).data, status=status.HTTP_201_CREATED)


class AccountStatementView(views.APIView):
    """
    GET /api/v1/ledger/account-statement
    Account ledger statement with opening balance, chronologically ordered lines,
    running balance, and closing balance.
    """

    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ACCOUNTANT, Role.ORG_ADMIN),
    ]

    def get(self, request):
        account_id = request.query_params.get("account")
        if not account_id:
            return Response(
                {
                    "error": {
                        "code": "account_required",
                        "message": "The 'account' query parameter is required.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        statement = account_statement(
            org=request.user.organization,
            account_identifier=account_id,
            date_from=date_from,
            date_to=date_to,
        )
        return Response(statement)


class TrialBalanceView(views.APIView):
    """
    GET /api/v1/ledger/trial-balance
    UC-27: Per-account debits and credits totals. Total debits must equal total credits.
    """

    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ACCOUNTANT, Role.ORG_ADMIN),
    ]

    def get(self, request):
        as_of = request.query_params.get("as_of")
        project_id = request.query_params.get("project")
        data = trial_balance(request.user.organization, as_of=as_of, project=project_id)
        return Response(data)


class ProfitLossView(views.APIView):
    """
    GET /api/v1/ledger/profit-loss
    UC-27: Revenue minus expenses by account.
    """

    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ACCOUNTANT, Role.ORG_ADMIN),
    ]

    def get(self, request):
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        project_id = request.query_params.get("project")
        data = profit_and_loss(request.user.organization, date_from, date_to, project=project_id)
        return Response(data)


class BalanceSheetView(views.APIView):
    """
    GET /api/v1/ledger/balance-sheet
    UC-27: Assets, liabilities, equity plus current-period earnings.
    """

    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ACCOUNTANT, Role.ORG_ADMIN),
    ]

    def get(self, request):
        as_of = request.query_params.get("as_of")
        data = balance_sheet(request.user.organization, as_of=as_of)
        return Response(data)


class ReconciliationView(views.APIView):
    """
    GET /api/v1/ledger/reconciliation
    Audit and reconcile double-entry ledger invariants, trial balance,
    balance sheet, and AP / Worker Advance subledgers.
    """

    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ACCOUNTANT, Role.ORG_ADMIN),
    ]

    def get(self, request):
        data = reconcile_ledger(request.user.organization)
        status_code = status.HTTP_200_OK if data["is_healthy"] else status.HTTP_409_CONFLICT
        return Response(data, status=status_code)
