from django.urls import include, path
from rest_framework.routers import DefaultRouter

from projects.views import BudgetCategoryViewSet, ProjectViewSet

router = DefaultRouter(trailing_slash=False)
router.register(r"projects", ProjectViewSet, basename="projects")
router.register(r"budget-categories", BudgetCategoryViewSet, basename="budget-categories")

urlpatterns = [
    path("", include(router.urls)),
]
