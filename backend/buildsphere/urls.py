from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('cost-estimator/', include('cost_estimator.urls')),
]
