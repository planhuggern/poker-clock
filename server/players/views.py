"""
Auth views for players.Player identity.

POST /auth/guest/    → create guest Player + issue tokens
POST /auth/refresh/  → exchange valid refresh token for new access token
"""
import json
import random
import uuid

from django.http import HttpRequest, JsonResponse
from django.utils import timezone
from django.views import View

from .jwt import decode_token, sign_access_token, sign_refresh_token
from .models import Player


def _random_display_name() -> str:
    return f"Gjest {random.randint(1000, 9999)}"


def _player_dict(player: Player) -> dict:
    return {
        "id": str(player.id),
        "display_name": player.display_name,
        "is_guest": player.is_guest,
    }


class GuestCreateView(View):
    """POST /auth/guest/ — create a new guest Player and return tokens."""

    def post(self, request: HttpRequest) -> JsonResponse:
        player = Player.objects.create(
            display_name=_random_display_name(),
            is_guest=True,
        )
        return JsonResponse(
            {
                "access": sign_access_token(player.id),
                "refresh": sign_refresh_token(player.id),
                "player": _player_dict(player),
            },
            status=201,
        )


class TokenRefreshView(View):
    """POST /auth/refresh/ — exchange a refresh token for a new access token."""

    def post(self, request: HttpRequest) -> JsonResponse:
        try:
            body = json.loads(request.body)
        except (json.JSONDecodeError, TypeError):
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        refresh_token = body.get("refresh", "")
        if not refresh_token:
            return JsonResponse({"error": "refresh token is required"}, status=400)

        payload = decode_token(refresh_token)
        if not payload or payload.get("token_type") != "refresh":
            return JsonResponse({"error": "Invalid or expired refresh token"}, status=401)

        try:
            player = Player.objects.get(pk=uuid.UUID(payload["player_id"]))
        except (KeyError, ValueError, Player.DoesNotExist):
            return JsonResponse({"error": "Player not found"}, status=401)

        player.last_seen_at = timezone.now()
        player.save(update_fields=["last_seen_at"])

        return JsonResponse({"access": sign_access_token(player.id)})
