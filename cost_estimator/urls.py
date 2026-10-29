from django.urls import path
from .views import (
    EstimateCreateView,
    EstimateResultView,
    EstimateDetailView,
    EstimateHistoryView,
    EstimateDeleteView,
    EstimateRecalculateView,
    EstimateAttachProjectView,
    EstimateExportPDFView,
)

app_name = 'cost_estimator'

urlpatterns = [
    path('', EstimateCreateView.as_view(), name='create'),
    path('<int:pk>/', EstimateResultView.as_view(), name='result'),
    path('<int:pk>/detail/', EstimateDetailView.as_view(), name='detail'),
    path('history/', EstimateHistoryView.as_view(), name='history'),
    path('<int:pk>/delete/', EstimateDeleteView.as_view(), name='delete'),
    path('<int:pk>/recalculate/', EstimateRecalculateView.as_view(), name='recalculate'),
    path('<int:pk>/attach/', EstimateAttachProjectView.as_view(), name='attach_project'),
    path('<int:pk>/pdf/', EstimateExportPDFView.as_view(), name='export_pdf'),
]
