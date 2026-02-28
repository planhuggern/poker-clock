"""
REST views for Tournament management.

Endpoints:
  GET   /clock/api/tournaments/            list all tournaments
  POST  /clock/api/tournaments/            admin: create new tournament
  GET   /clock/api/tournaments/<id>/       get tournament details + state
  PATCH /clock/api/tournaments/<id>/       admin: update name/state_json
  POST  /clock/api/tournaments/<id>/finish/  admin: mark tournament as finished
"""
import json

import jwt as pyjwt
from django.conf import settings
from django.http import HttpRequest, JsonResponse
from django.views import View

from .models import Tournament
from . import state as gs
from .tick import start_tick_thread


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


def _require_admin(request: HttpRequest):
    """Return (payload, None) for admins or (None, error response)."""
    payload = _decode_jwt(request)
    if not payload:
        return None, JsonResponse({"error": "Authentication required"}, status=401)
    if payload.get("role") != "admin":
        return None, JsonResponse({"error": "Admin role required"}, status=403)
    return payload, None


#  Collection view 

class TournamentListView(View):

    def get(self, request: HttpRequest) -> JsonResponse:
        """List all tournaments (optionally filtered by ?status=pending|running|finished)."""
        qs = Tournament.objects.all()
        status_filter = request.GET.get("status")
        if status_filter in (Tournament.STATUS_PENDING, Tournament.STATUS_RUNNING, Tournament.STATUS_FINISHED):
            qs = qs.filter(status=status_filter)
        return JsonResponse([t.to_dict() for t in qs], safe=False)

    def post(self, request: HttpRequest) -> JsonResponse:
        """Admin: create a new tournament."""
        _, err = _require_admin(request)
        if err:
            return err

        try:
            body = json.loads(request.body or "{}")
        except (json.JSONDecodeError, TypeError):
            body = {}

        name = body.get("name", "Pokerturnering")
        if not isinstance(name, str) or not name.strip():
            return JsonResponse({"error": "name must be a non-empty string"}, status=400)

        # Optional pre-seeded state_json (e.g. a preset)
        state_json = body.get("state_json") or {}
        if not isinstance(state_json, dict):
            state_json = {}

        tournament = Tournament.objects.create(
            name=name.strip(),
            status=Tournament.STATUS_PENDING,
            state_json=state_json,
        )

        # Load into in-memory state engine and start tick thread
        gs.init_state(state_json or None, tournament_id=tournament.id)
        start_tick_thread(tournament_id=tournament.id)

        return JsonResponse(tournament.to_dict(), status=201)


#  Detail view 

class TournamentDetailView(View):

    def _get_tournament(self, pk):
        try:
            return Tournament.objects.get(pk=pk), None
        except Tournament.DoesNotExist:
            return None, JsonResponse({"error": "Tournament not found"}, status=404)

    def get(self, request: HttpRequest, pk: int) -> JsonResponse:
        tournament, err = self._get_tournament(pk)
        if err:
            return err

        data = tournament.to_dict()
        # Include live in-memory state if available
        try:
            snap = gs.get_snapshot(tournament_id=tournament.id)
            data["snapshot"] = snap
        except KeyError:
            data["snapshot"] = None
        # Include registered players
        entries = tournament.entries.select_related("player").filter(is_active=True).order_by("joined_at")
        data["players"] = [e.to_dict() for e in entries]
        return JsonResponse(data)

    def patch(self, request: HttpRequest, pk: int) -> JsonResponse:
        """Admin: update tournament name or initial state_json."""
        _, err = _require_admin(request)
        if err:
            return err

        tournament, err = self._get_tournament(pk)
        if err:
            return err

        try:
            body = json.loads(request.body or "{}")
        except (json.JSONDecodeError, TypeError):
            body = {}

        if "name" in body:
            name = body["name"]
            if not isinstance(name, str) or not name.strip():
                return JsonResponse({"error": "name must be a non-empty string"}, status=400)
            tournament.name = name.strip()

        tournament.save()
        return JsonResponse(tournament.to_dict())


class TournamentFinishView(View):
    """POST /clock/api/tournaments/<id>/finish/  admin marks a tournament as finished."""

    def post(self, request: HttpRequest, pk: int) -> JsonResponse:
        _, err = _require_admin(request)
        if err:
            return err

        try:
            tournament = Tournament.objects.get(pk=pk)
        except Tournament.DoesNotExist:
            return JsonResponse({"error": "Tournament not found"}, status=404)

        if tournament.status == Tournament.STATUS_FINISHED:
            return JsonResponse({"error": "Tournament is already finished"}, status=409)

        # Stop the clock in memory
        try:
            def _stop(s):
                s["running"] = False
                s["startedAtMs"] = None
            gs.with_state(_stop, tournament_id=tournament.id)
            state_json = gs.get_state_copy(tournament_id=tournament.id)
        except KeyError:
            state_json = tournament.state_json

        tournament.status = Tournament.STATUS_FINISHED
        tournament.state_json = state_json
        tournament.save()

        return JsonResponse(tournament.to_dict())
