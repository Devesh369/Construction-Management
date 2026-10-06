from django.urls import include, path
from rest_framework.routers import DefaultRouter

from audit.views import AuditLogViewSet

router = DefaultRouter(trailing_slash=False)
router.register(r"audit-logs", AuditLogViewSet, basename="audit-logs")

urlpatterns = [
    path("", include(router.urls)),
]
