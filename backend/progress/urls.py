from django.urls import include, path
from rest_framework.routers import DefaultRouter

from progress.views import DailyProgressReportViewSet, WorkEntryViewSet

router = DefaultRouter(trailing_slash=False)
router.register(r"dpr", DailyProgressReportViewSet, basename="dpr")
router.register(r"work-entries", WorkEntryViewSet, basename="work-entries")

urlpatterns = [
    path("", include(router.urls)),
]
