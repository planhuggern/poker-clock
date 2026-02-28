from django.urls import path
from .views import DevAuthView, GoogleCallbackView, GoogleLoginView
from .player_views import MeView, PlayerListView, RegisterView
from .tournament_views import TournamentDetailView, TournamentFinishView, TournamentListView

urlpatterns = [
    path("auth/google", GoogleLoginView.as_view(), name="auth-google"),
    path("auth/google/callback", GoogleCallbackView.as_view(), name="auth-google-callback"),
    path("auth/dev", DevAuthView.as_view(), name="auth-dev"),
    # Player API
    path("clock/api/me/", MeView.as_view(), name="player-me"),
    path("clock/api/me/register/", RegisterView.as_view(), name="player-register"),
    path("clock/api/players/", PlayerListView.as_view(), name="player-list"),
    # Tournament API
    path("clock/api/tournaments/", TournamentListView.as_view(), name="tournament-list"),
    path("clock/api/tournaments/<int:pk>/", TournamentDetailView.as_view(), name="tournament-detail"),
    path("clock/api/tournaments/<int:pk>/finish/", TournamentFinishView.as_view(), name="tournament-finish"),
]
