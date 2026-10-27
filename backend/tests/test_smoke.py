"""
Phase P0 Smoke Tests: verifies project configuration, app registration,
custom user model setup, and OpenAPI schema loading.
"""

import pytest
from django.conf import settings
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.mark.django_db
class TestSmokeAndInfrastructure:
    def test_all_12_apps_registered(self):
        """Verify all 12 required portal apps are registered in INSTALLED_APPS."""
        required_apps = [
            "core.apps.CoreConfig",
            "accounts.apps.AccountsConfig",
            "audit.apps.AuditConfig",
            "projects.apps.ProjectsConfig",
            "ledger.apps.LedgerConfig",
            "workforce.apps.WorkforceConfig",
            "progress.apps.ProgressConfig",
            "attendance.apps.AttendanceConfig",
            "expenses.apps.ExpensesConfig",
            "payroll.apps.PayrollConfig",
            "dashboard.apps.DashboardConfig",
            "reports.apps.ReportsConfig",
        ]
        for app in required_apps:
            assert app in settings.INSTALLED_APPS, f"{app} is not registered in INSTALLED_APPS"

    def test_custom_user_model_configured(self):
        """Verify AUTH_USER_MODEL points to accounts.User."""
        assert settings.AUTH_USER_MODEL == "accounts.User"

    def test_swagger_and_schema_endpoints(self):
        """Verify OpenAPI schema and Swagger UI endpoints load cleanly."""
        client = APIClient()
        schema_url = reverse("schema")
        swagger_url = reverse("swagger-ui")

        schema_res = client.get(schema_url)
        assert schema_res.status_code == 200, f"Schema endpoint failed: {schema_res.status_code}"

        swagger_res = client.get(swagger_url)
        assert (
            swagger_res.status_code == 200
        ), f"Swagger UI endpoint failed: {swagger_res.status_code}"
