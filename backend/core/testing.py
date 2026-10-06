"""
Testing helpers and mixins for tenant isolation verification.
"""

from rest_framework import status


class TenantIsolationTestMixin:
    """
    Mixin for API tests to verify cross-tenant data isolation.
    Ensures that fetching, updating, or deleting another tenant's record yields HTTP 404 (Not Found).
    """

    def assert_cross_tenant_404(self, client, url, data=None, method="get"):
        """
        Verify that accessing a foreign tenant resource returns 404 Not Found.
        """
        http_method = getattr(client, method.lower())
        if method.lower() in ["post", "patch", "put"]:
            response = http_method(url, data=data, format="json")
        else:
            response = http_method(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND, (
            f"Expected 404 Not Found for cross-tenant request to {url}, "
            f"but got status {response.status_code}."
        )
