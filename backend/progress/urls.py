from django.urls import include, path
from rest_framework.routers import DefaultRouter

from progress.views import DailyProgressReportViewSet

router = DefaultRouter(trailing_slash=False)
router.register(r"dpr", DailyProgressReportViewSet, basename="dpr")

urlpatterns = [
    path("", include(router.urls)),
]
