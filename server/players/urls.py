from django.urls import path

from .views import GuestCreateView, TokenRefreshView

urlpatterns = [
    path("auth/guest/", GuestCreateView.as_view(), name="guest-create"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
]
