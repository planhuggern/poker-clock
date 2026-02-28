"""
REST views for player registration and profile management.

Endpoints:
  GET   /clock/api/me/             get (or auto-create) my player profile
  PATCH /clock/api/me/             update my nickname
  POST  /clock/api/me/register/    register for a tournament {tournament_id}
  GET   /clock/api/players/        list players in a tournament ?tournament_id=<id>

Authentication: Authorization: Bearer <jwt>
"""
import json

import jwt as pyjwt
from django.conf import settings
from django.http import HttpRequest, JsonResponse
from django.views import View

from .models import Player, Tournament, TournamentEntry


#  JWT helper 

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


#  Views 

class MeView(View):
    """GET/PATCH own player profile."""

    def get(self, request: HttpRequest) -> JsonResponse:
        payload, err = _require_auth(request)
        if err:
            return err
        player = _get_or_create_player(payload["username"])
        # Include active tournament info if available
        entry = player.active_entry()
        data = player.to_dict()
        data["activeTournamentId"] = entry.tournament_id if entry else None
        return JsonResponse(data)

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
    """POST registers the authenticated player in a tournament.

    Request body: {"tournament_id": <int>}  (defaults to 1 if omitted)

    Rules:
    - A player may not be in more than one non-finished tournament at once.
    - Re-joining the same tournament after busting is allowed.
    """

    def post(self, request: HttpRequest) -> JsonResponse:
        payload, err = _require_auth(request)
        if err:
            return err

        try:
            body = json.loads(request.body or "{}")
        except (json.JSONDecodeError, TypeError):
            body = {}

        tournament_id = body.get("tournament_id", 1)
        try:
            tournament_id = int(tournament_id)
        except (TypeError, ValueError):
            return JsonResponse({"error": "Invalid tournament_id"}, status=400)

        try:
            tournament = Tournament.objects.get(pk=tournament_id)
        except Tournament.DoesNotExist:
            return JsonResponse({"error": "Tournament not found"}, status=404)

        if tournament.status == Tournament.STATUS_FINISHED:
            return JsonResponse({"error": "Tournament is already finished"}, status=409)

        player = _get_or_create_player(payload["username"])

        # Check if already in another non-finished tournament
        conflict = (
            player.entries
            .select_related("tournament")
            .filter(
                is_active=True,
                tournament__status__in=[Tournament.STATUS_PENDING, Tournament.STATUS_RUNNING],
            )
            .exclude(tournament_id=tournament_id)
            .first()
        )
        if conflict:
            return JsonResponse(
                {
                    "error": "Already registered in another active tournament",
                    "conflictTournamentId": conflict.tournament_id,
                },
                status=409,
            )

        entry, created = TournamentEntry.objects.get_or_create(
            player=player,
            tournament=tournament,
            defaults={"is_active": True},
        )

        # Re-activate if busted
        if not created and not entry.is_active:
            entry.is_active = True
            entry.save(update_fields=["is_active"])
            created = True

        status = 201 if created else 200
        return JsonResponse(
            {"registered": True, "player": player.to_dict(tournament=tournament)},
            status=status,
        )


class PlayerListView(View):
    """GET list of players in a specific tournament (public).

    Query params: ?tournament_id=<int>  (defaults to 1)
    """

    def get(self, request: HttpRequest) -> JsonResponse:
        try:
            tournament_id = int(request.GET.get("tournament_id", 1))
        except (TypeError, ValueError):
            tournament_id = 1

        entries = (
            TournamentEntry.objects
            .select_related("player")
            .filter(tournament_id=tournament_id)
            .order_by("joined_at")
        )
        return JsonResponse([e.to_dict() for e in entries], safe=False)
