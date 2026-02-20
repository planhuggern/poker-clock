from django.urls import path
from .views import DevAuthView, GoogleCallbackView, GoogleLoginView

urlpatterns = [
    path("auth/google", GoogleLoginView.as_view(), name="auth-google"),
    path("auth/google/callback", GoogleCallbackView.as_view(), name="auth-google-callback"),
    path("auth/dev", DevAuthView.as_view(), name="auth-dev"),
]
