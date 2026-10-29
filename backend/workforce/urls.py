from django.urls import include, path
from rest_framework.routers import DefaultRouter

from workforce.views import EmployeeViewSet, LaborGroupViewSet

router = DefaultRouter(trailing_slash=False)
router.register(r"employees", EmployeeViewSet, basename="employees")
router.register(r"labor-groups", LaborGroupViewSet, basename="labor-groups")

urlpatterns = [
    path("", include(router.urls)),
]
