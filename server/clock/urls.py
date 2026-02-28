from django.urls import path
from .views import DevAuthView, GoogleCallbackView, GoogleLoginView
from .player_views import MeView, PlayerListView, RegisterView

urlpatterns = [
    path("auth/google", GoogleLoginView.as_view(), name="auth-google"),
    path("auth/google/callback", GoogleCallbackView.as_view(), name="auth-google-callback"),
    path("auth/dev", DevAuthView.as_view(), name="auth-dev"),
    # Player API
    path("clock/api/me/", MeView.as_view(), name="player-me"),
    path("clock/api/me/register/", RegisterView.as_view(), name="player-register"),
    path("clock/api/players/", PlayerListView.as_view(), name="player-list"),
]
