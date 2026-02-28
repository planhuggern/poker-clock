"""
REST views for player registration and profile management.

Endpoints:
  GET  /clock/api/me/            – get (or auto-create) my player profile
  PATCH /clock/api/me/           – update my nickname
  POST  /clock/api/me/register/  – join the current tournament
  GET  /clock/api/players/       – list all tournament registrants (public)

Authentication: Authorization: Bearer <jwt>
The JWT payload must have a "username" claim (set by views.py at login).
"""
import json

import jwt as pyjwt
from django.conf import settings
from django.http import HttpRequest, JsonResponse
from django.views import View

from .models import Player, TournamentEntry


# ── JWT helper ─────────────────────────────────────────────────────────────────

def _decode_jwt(request: HttpRequest) -> dict | None:
    auth = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:].strip()
    secret = settings.CONFIG.get("jwtSecret", "")
    try:
        return pyjwt.decode(token, secret, algorithms=["HS256"])
    except Exception:
        return None


def _require_auth(request: HttpRequest):
    """Decode JWT; return (payload, None) or (None, 401 response)."""
    payload = _decode_jwt(request)
    if not payload or not payload.get("username"):
        return None, JsonResponse({"error": "Authentication required"}, status=401)
    return payload, None


def _get_or_create_player(username: str) -> Player:
    player, _ = Player.objects.get_or_create(
        username=username,
        defaults={"nickname": ""},
    )
    return player


# ── Views ──────────────────────────────────────────────────────────────────────

class MeView(View):
    """GET/PATCH own player profile."""

    def get(self, request: HttpRequest) -> JsonResponse:
        payload, err = _require_auth(request)
        if err:
            return err

        player = _get_or_create_player(payload["username"])
        return JsonResponse(player.to_dict())

    def patch(self, request: HttpRequest) -> JsonResponse:
        payload, err = _require_auth(request)
        if err:
            return err

        try:
            body = json.loads(request.body)
        except (json.JSONDecodeError, TypeError):
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        if "nickname" not in body:
            return JsonResponse({"error": "nickname is required"}, status=400)

        nickname = body["nickname"]
        if not isinstance(nickname, str) or not nickname.strip():
            return JsonResponse({"error": "nickname must be a non-empty string"}, status=400)
        if len(nickname) > 64:
            return JsonResponse({"error": "nickname must be 64 characters or fewer"}, status=400)

        player = _get_or_create_player(payload["username"])
        player.nickname = nickname.strip()
        player.save(update_fields=["nickname"])
        return JsonResponse(player.to_dict())


class RegisterView(View):
    """POST to register the authenticated player for the current tournament."""

    def post(self, request: HttpRequest) -> JsonResponse:
        payload, err = _require_auth(request)
        if err:
            return err

        player = _get_or_create_player(payload["username"])
        entry, created = TournamentEntry.objects.get_or_create(player=player)

        # If a previously busted player re-registers, reactivate them
        if not created and not entry.is_active:
            entry.is_active = True
            entry.save(update_fields=["is_active"])
            created = True  # treat reactivation as a fresh registration

        status = 201 if created else 200
        return JsonResponse({"registered": True, "player": player.to_dict()}, status=status)


class PlayerListView(View):
    """GET list of all players with active tournament entries (public)."""

    def get(self, request: HttpRequest) -> JsonResponse:
        entries = (
            TournamentEntry.objects
            .select_related("player")
            .order_by("joined_at")
        )
        return JsonResponse([e.to_dict() for e in entries], safe=False)
