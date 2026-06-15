"""
REST views for Tournament management.

Endpoints:
  GET   /clock/api/tournaments/            list all tournaments
  POST  /clock/api/tournaments/            create new tournament (requires players.Player auth)
  GET   /clock/api/tournaments/<id>/       get tournament details + state
  PATCH /clock/api/tournaments/<id>/       host: update name
  POST  /clock/api/tournaments/<id>/finish/  host: mark tournament as finished
"""
import json

from django.http import HttpRequest, JsonResponse
from django.views import View

from players.auth import authenticate_request
from .models import Tournament
from . import state as gs
from .tick import start_tick_thread


def _require_host(request: HttpRequest, tournament: Tournament):
    """Return (player, None) for the tournament host, or (None, error response)."""
    player = authenticate_request(request)
    if not player:
        return None, JsonResponse({"error": "Authentication required"}, status=401)
    if tournament.host_id != player.pk:
        return None, JsonResponse({"error": "Host access required"}, status=403)
    return player, None


class TournamentListView(View):

    def get(self, request: HttpRequest) -> JsonResponse:
        qs = Tournament.objects.all()
        status_filter = request.GET.get("status")
        if status_filter in (Tournament.STATUS_PENDING, Tournament.STATUS_RUNNING, Tournament.STATUS_FINISHED):
            qs = qs.filter(status=status_filter)
        return JsonResponse([t.to_dict() for t in qs], safe=False)

    def post(self, request: HttpRequest) -> JsonResponse:
        player = authenticate_request(request)
        if not player:
            return JsonResponse({"error": "Authentication required"}, status=401)

        try:
            body = json.loads(request.body or "{}")
        except (json.JSONDecodeError, TypeError):
            body = {}

        name = body.get("name", "")
        if not isinstance(name, str) or not name.strip():
            return JsonResponse({"error": "name must be a non-empty string"}, status=400)

        state_json = body.get("state_json") or {}
        if not isinstance(state_json, dict):
            state_json = {}

        tournament = Tournament.objects.create(
            name=name.strip(),
            status=Tournament.STATUS_PENDING,
            state_json=state_json,
            host=player,
        )

        gs.init_state(state_json or None, tournament_id=tournament.id)
        start_tick_thread(tournament_id=tournament.id)

        return JsonResponse(tournament.to_dict(), status=201)


class TournamentDetailView(View):

    def _get_tournament(self, pk):
        try:
            return Tournament.objects.select_related("host").get(pk=pk), None
        except Tournament.DoesNotExist:
            return None, JsonResponse({"error": "Tournament not found"}, status=404)

    def get(self, request: HttpRequest, pk: int) -> JsonResponse:
        tournament, err = self._get_tournament(pk)
        if err:
            return err

        data = tournament.to_dict()
        try:
            snap = gs.get_snapshot(tournament_id=tournament.id)
            data["snapshot"] = snap
        except KeyError:
            data["snapshot"] = None
        entries = tournament.entries.select_related("player").filter(is_active=True).order_by("joined_at")
        data["players"] = [e.to_dict() for e in entries]
        return JsonResponse(data)

    def patch(self, request: HttpRequest, pk: int) -> JsonResponse:
        tournament, err = self._get_tournament(pk)
        if err:
            return err

        _, err = _require_host(request, tournament)
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

    def post(self, request: HttpRequest, pk: int) -> JsonResponse:
        try:
            tournament = Tournament.objects.select_related("host").get(pk=pk)
        except Tournament.DoesNotExist:
            return JsonResponse({"error": "Tournament not found"}, status=404)

        _, err = _require_host(request, tournament)
        if err:
            return err

        if tournament.status == Tournament.STATUS_FINISHED:
            return JsonResponse({"error": "Tournament is already finished"}, status=409)

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
