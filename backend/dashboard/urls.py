from django.urls import path

from dashboard.views import DashboardOverviewView, DashboardProjectDetailView

urlpatterns = [
    path("overview", DashboardOverviewView.as_view(), name="dashboard-overview"),
    path("overview/", DashboardOverviewView.as_view(), name="dashboard-overview-slash"),
    path(
        "projects/<int:pk>", DashboardProjectDetailView.as_view(), name="dashboard-project-detail"
    ),
    path(
        "projects/<int:pk>/",
        DashboardProjectDetailView.as_view(),
        name="dashboard-project-detail-slash",
    ),
]
