from django.urls import include, path
from rest_framework.routers import DefaultRouter

from attendance.views import AttendanceViewSet, HolidayViewSet, NightShiftSessionViewSet

router = DefaultRouter(trailing_slash=False)
router.register(r"attendance", AttendanceViewSet, basename="attendance")
router.register(r"holidays", HolidayViewSet, basename="holidays")
router.register(r"night-shifts", NightShiftSessionViewSet, basename="night-shifts")

urlpatterns = [
    path("", include(router.urls)),
]
