"""
Root URL Configuration for Construction Management Portal.
All feature APIs are versioned under /api/v1/.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

admin.site.site_header = f"{getattr(settings, 'SITE_NAME', 'BuildSphere')} Administration"
admin.site.site_title = getattr(settings, "SITE_NAME", "BuildSphere")
admin.site.index_title = "Portal Administration"

urlpatterns = [
    path("admin/", admin.site.urls),
    # OpenAPI schema and API documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    # Feature module APIs (/api/v1/...)
    path(
        "api/v1/",
        include(
            [
                path("", include("accounts.urls")),
                path("", include("projects.urls")),
                path("", include("workforce.urls")),
                path("", include("attendance.urls")),
                path("", include("progress.urls")),
                path("", include("expenses.urls")),
                path("payroll/", include("payroll.urls")),
                path("", include("payroll.urls")),
                path("ledger/", include("ledger.urls")),
                path("", include("ledger.urls")),
                path("", include("audit.urls")),
                path("dashboard/", include("dashboard.urls")),
                path("reports/", include("reports.urls")),
            ]
        ),
    ),
    path("cost-estimator/", include("cost_estimator.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
