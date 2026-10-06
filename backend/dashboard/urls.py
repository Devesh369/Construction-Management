from django.urls import path

from dashboard.views import DashboardOverviewView, DashboardProjectDetailView

urlpatterns = [
    path("overview", DashboardOverviewView.as_view(), name="dashboard-overview"),
    path(
        "projects/<int:pk>", DashboardProjectDetailView.as_view(), name="dashboard-project-detail"
    ),
]
