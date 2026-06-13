"""
Authentication helpers for players.Player JWT.

Two forms provided:

  authenticate_request(request) -> Player | None
    Plain Django helper — use in View subclasses that don't need DRF.
    Sets nothing on request; caller decides what to do with the result.

  PlayerJWTAuthentication
    DRF BaseAuthentication subclass — wire in via DEFAULT_AUTHENTICATION_CLASSES
    or per-view authentication_classes.  Returns (player, None) on success.
"""
import uuid

from django.http import HttpRequest

from .jwt import decode_token
from .models import Player


def authenticate_request(request: HttpRequest) -> "Player | None":
    """Extract Bearer token, verify it, and return the owning Player or None."""
    auth = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth.startswith("Bearer "):
        return None
    payload = decode_token(auth[7:].strip())
    if not payload or payload.get("token_type") != "access":
        return None
    try:
        return Player.objects.get(pk=uuid.UUID(payload["player_id"]))
    except (KeyError, ValueError, Player.DoesNotExist):
        return None


# ── DRF authentication class ──────────────────────────────────────────────────

try:
    from rest_framework.authentication import BaseAuthentication
    from rest_framework.exceptions import AuthenticationFailed

    class PlayerJWTAuthentication(BaseAuthentication):
        """
        DRF authentication class for Player JWTs.

        Returns (player, None) on success so request.user is a players.Player
        instance.  Wire in per-view or globally in REST_FRAMEWORK settings.
        """

        def authenticate(self, request):
            auth = request.META.get("HTTP_AUTHORIZATION", "")
            if not auth.startswith("Bearer "):
                return None  # Let other authenticators try
            payload = decode_token(auth[7:].strip())
            if not payload or payload.get("token_type") != "access":
                raise AuthenticationFailed("Invalid or expired access token.")
            try:
                player = Player.objects.get(pk=uuid.UUID(payload["player_id"]))
            except (KeyError, ValueError, Player.DoesNotExist):
                raise AuthenticationFailed("Player not found.")
            return (player, None)

except ImportError:
    pass  # djangorestframework not installed — DRF class simply not available
