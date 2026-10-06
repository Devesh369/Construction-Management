"""
Ledger views: Chart of accounts, journal entries, statements.
"""

from rest_framework import status, views, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsTenantUser, roles_required
from core.roles import Role
from core.views import TenantViewSet
from ledger.models import Account, JournalEntry
from ledger.serializers import AccountSerializer, JournalEntrySerializer
from ledger.services import (
    balance_sheet,
    post_journal_entry,
    profit_and_loss,
    reverse_entry,
    trial_balance,
)


class AccountViewSet(TenantViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer
    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ACCOUNTANT, Role.ORG_ADMIN),
    ]
    filterset_fields = ["type", "is_active"]
    search_fields = ["code", "name"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Account.objects.none()
        return Account.objects.filter(organization=self.request.user.organization)


class JournalEntryViewSet(
    viewsets.ReadOnlyModelViewSet,
):
    queryset = JournalEntry.objects.all()
    serializer_class = JournalEntrySerializer
    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ACCOUNTANT, Role.ORG_ADMIN),
    ]
    filterset_fields = ["project", "reference_type", "date"]
    search_fields = ["entry_number", "description"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return JournalEntry.objects.none()
        return JournalEntry.objects.filter(
            organization=self.request.user.organization
        ).prefetch_related("lines__account")

    def create(self, request, *args, **kwargs):
        """Post a manual journal entry."""
        data = request.data
        entry = post_journal_entry(
            org=request.user.organization,
            date=data.get("date"),
            description=data.get("description", ""),
            lines=data.get("lines", []),
            reference_type="MANUAL",
            user=request.user,
            project_id=data.get("project_id"),
        )
        return Response(JournalEntrySerializer(entry).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="reverse")
    def reverse(self, request, pk=None):
        entry = self.get_object()
        reason = request.data.get("reason", "Manual reversal")
        reversal = reverse_entry(entry, user=request.user, reason=reason)
        return Response(JournalEntrySerializer(reversal).data, status=status.HTTP_201_CREATED)


class TrialBalanceView(views.APIView):
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
    permission_classes = [
        IsAuthenticated,
        IsTenantUser,
        roles_required(Role.ACCOUNTANT, Role.ORG_ADMIN),
    ]

    def get(self, request):
        as_of = request.query_params.get("as_of")
        data = balance_sheet(request.user.organization, as_of=as_of)
        return Response(data)
