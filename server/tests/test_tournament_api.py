"""
Tests for the Tournament REST API.

Endpoints:
  GET   /clock/api/tournaments/               list
  POST  /clock/api/tournaments/               create (players.Player auth required)
  GET   /clock/api/tournaments/<id>/          detail
  PATCH /clock/api/tournaments/<id>/          host only: rename
  POST  /clock/api/tournaments/<id>/finish/   host only: finish
"""
import pytest

from django.test import Client

from players.models import Player as PortalPlayer
from players.jwt import sign_access_token


# ── auth helpers ───────────────────────────────────────────────────────────────

def _make_player(display_name: str = "Player") -> PortalPlayer:
    return PortalPlayer.objects.create(display_name=display_name)


def _auth(player: PortalPlayer) -> dict:
    return {"HTTP_AUTHORIZATION": f"Bearer {sign_access_token(player.id)}"}


def _make_tournament(host: PortalPlayer | None = None, name: str = "T"):
    from clock.models import Tournament
    from clock import state as gs
    t = Tournament.objects.create(name=name, host=host)
    gs.init_state(None, tournament_id=t.id)
    return t


# ── GET /clock/api/tournaments/ ───────────────────────────────────────────────

@pytest.mark.django_db
class TestTournamentList:

    def test_returns_200(self):
        r = Client().get("/clock/api/tournaments/")
        assert r.status_code == 200

    def test_returns_list(self):
        r = Client().get("/clock/api/tournaments/")
        assert isinstance(r.json(), list)

    def test_default_tournament_in_list(self):
        r = Client().get("/clock/api/tournaments/")
        ids = [t["id"] for t in r.json()]
        assert 1 in ids

    def test_filter_by_status(self):
        from clock.models import Tournament
        Tournament.objects.create(name="Ferdig", status=Tournament.STATUS_FINISHED, state_json={})
        r = Client().get("/clock/api/tournaments/?status=finished")
        assert all(t["status"] == "finished" for t in r.json())

    def test_tournament_entry_has_expected_fields(self):
        r = Client().get("/clock/api/tournaments/")
        t = next(x for x in r.json() if x["id"] == 1)
        for field in ("id", "name", "status", "created_at", "playerCount", "host"):
            assert field in t, f"Missing field: {field}"


# ── POST /clock/api/tournaments/ ──────────────────────────────────────────────

@pytest.mark.django_db
class TestTournamentCreate:

    def test_authenticated_player_can_create(self):
        player = _make_player("Host")
        r = Client().post(
            "/clock/api/tournaments/",
            data='{"name": "Ny turnering"}',
            content_type="application/json",
            **_auth(player),
        )
        assert r.status_code == 201

    def test_create_response_has_id(self):
        player = _make_player()
        r = Client().post(
            "/clock/api/tournaments/",
            data='{"name": "Test"}',
            content_type="application/json",
            **_auth(player),
        )
        assert "id" in r.json()

    def test_unauthenticated_cannot_create(self):
        r = Client().post(
            "/clock/api/tournaments/",
            data='{"name": "Ulovlig"}',
            content_type="application/json",
        )
        assert r.status_code == 401

    def test_empty_name_returns_400(self):
        player = _make_player()
        r = Client().post(
            "/clock/api/tournaments/",
            data='{"name": ""}',
            content_type="application/json",
            **_auth(player),
        )
        assert r.status_code == 400

    def test_created_tournament_has_pending_status(self):
        player = _make_player()
        r = Client().post(
            "/clock/api/tournaments/",
            data='{"name": "Ny turnering"}',
            content_type="application/json",
            **_auth(player),
        )
        assert r.json()["status"] == "pending"

    def test_new_tournament_loaded_in_state_engine(self):
        from clock import state as gs
        player = _make_player()
        r = Client().post(
            "/clock/api/tournaments/",
            data='{"name": "State-test"}',
            content_type="application/json",
            **_auth(player),
        )
        tid = r.json()["id"]
        assert gs.get_snapshot(tournament_id=tid) is not None

    def test_creator_is_set_as_host(self):
        player = _make_player("Alice")
        r = Client().post(
            "/clock/api/tournaments/",
            data='{"name": "HostTest"}',
            content_type="application/json",
            **_auth(player),
        )
        assert r.status_code == 201
        data = r.json()
        assert data["host"] is not None
        assert data["host"]["id"] == str(player.id)
        assert data["host"]["display_name"] == "Alice"


# ── GET /clock/api/tournaments/<id>/ ─────────────────────────────────────────

@pytest.mark.django_db
class TestTournamentDetail:

    def test_returns_200_for_existing(self):
        r = Client().get("/clock/api/tournaments/1/")
        assert r.status_code == 200

    def test_returns_404_for_missing(self):
        r = Client().get("/clock/api/tournaments/99999/")
        assert r.status_code == 404

    def test_detail_includes_players(self):
        r = Client().get("/clock/api/tournaments/1/")
        data = r.json()
        assert "players" in data
        assert isinstance(data["players"], list)


# ── PATCH /clock/api/tournaments/<id>/ ───────────────────────────────────────

@pytest.mark.django_db
class TestTournamentPatch:

    def test_host_can_rename(self):
        host = _make_player("Host")
        t = _make_tournament(host=host, name="Original")
        r = Client().patch(
            f"/clock/api/tournaments/{t.id}/",
            data='{"name": "Renamed"}',
            content_type="application/json",
            **_auth(host),
        )
        assert r.status_code == 200
        assert r.json()["name"] == "Renamed"

    def test_non_host_cannot_rename(self):
        host = _make_player("Host")
        other = _make_player("Other")
        t = _make_tournament(host=host)
        r = Client().patch(
            f"/clock/api/tournaments/{t.id}/",
            data='{"name": "Hacked"}',
            content_type="application/json",
            **_auth(other),
        )
        assert r.status_code == 403

    def test_unauthenticated_cannot_rename(self):
        host = _make_player("Host")
        t = _make_tournament(host=host)
        r = Client().patch(
            f"/clock/api/tournaments/{t.id}/",
            data='{"name": "Hacked"}',
            content_type="application/json",
        )
        assert r.status_code == 401

    def test_empty_name_returns_400(self):
        host = _make_player("Host")
        t = _make_tournament(host=host)
        r = Client().patch(
            f"/clock/api/tournaments/{t.id}/",
            data='{"name": ""}',
            content_type="application/json",
            **_auth(host),
        )
        assert r.status_code == 400


# ── POST /clock/api/tournaments/<id>/finish/ ─────────────────────────────────

@pytest.mark.django_db
class TestTournamentFinish:

    def test_host_can_finish(self):
        host = _make_player("Host")
        t = _make_tournament(host=host)
        r = Client().post(f"/clock/api/tournaments/{t.id}/finish/", **_auth(host))
        assert r.status_code == 200

    def test_finish_sets_status_to_finished(self):
        host = _make_player("Host")
        t = _make_tournament(host=host)
        r = Client().post(f"/clock/api/tournaments/{t.id}/finish/", **_auth(host))
        assert r.json()["status"] == "finished"

    def test_finish_already_finished_returns_409(self):
        from clock.models import Tournament
        host = _make_player("Host")
        t = _make_tournament(host=host)
        Tournament.objects.filter(pk=t.id).update(status=Tournament.STATUS_FINISHED)
        r = Client().post(f"/clock/api/tournaments/{t.id}/finish/", **_auth(host))
        assert r.status_code == 409

    def test_finish_nonexistent_returns_404(self):
        host = _make_player("Host")
        r = Client().post("/clock/api/tournaments/99999/finish/", **_auth(host))
        assert r.status_code == 404

    def test_non_host_cannot_finish(self):
        host = _make_player("Host")
        other = _make_player("Other")
        t = _make_tournament(host=host)
        r = Client().post(f"/clock/api/tournaments/{t.id}/finish/", **_auth(other))
        assert r.status_code == 403

    def test_unauthenticated_cannot_finish(self):
        host = _make_player("Host")
        t = _make_tournament(host=host)
        r = Client().post(f"/clock/api/tournaments/{t.id}/finish/")
        assert r.status_code == 401


# ── Multi-tournament registration ─────────────────────────────────────────────

@pytest.mark.django_db
class TestMultiTournamentRegistration:
    """Registration tests use the old clock.Player JWT system — unchanged."""

    import time
    import jwt as pyjwt

    _SECRET = "test-jwt-secret"

    @staticmethod
    def _old_token(username: str, role: str = "viewer") -> str:
        import time
        import jwt as pyjwt
        return pyjwt.encode(
            {"username": username, "role": role,
             "iat": int(time.time()), "exp": int(time.time()) + 3600},
            "test-jwt-secret", algorithm="HS256",
        )

    @staticmethod
    def _old_auth(username: str = "user@example.com") -> dict:
        return {"HTTP_AUTHORIZATION": f"Bearer {TestMultiTournamentRegistration._old_token(username)}"}

    def test_player_can_register_in_first_tournament(self):
        r = Client().post(
            "/clock/api/me/register/",
            data='{"tournament_id": 1}',
            content_type="application/json",
            **self._old_auth("player1@example.com"),
        )
        assert r.status_code == 201

    def test_player_cannot_register_in_two_active_tournaments(self):
        t2 = _make_tournament(name="Second")
        Client().post(
            "/clock/api/me/register/",
            data='{"tournament_id": 1}',
            content_type="application/json",
            **self._old_auth("player2@example.com"),
        )
        r = Client().post(
            "/clock/api/me/register/",
            data=f'{{"tournament_id": {t2.id}}}',
            content_type="application/json",
            **self._old_auth("player2@example.com"),
        )
        assert r.status_code == 409

    def test_conflict_response_includes_conflicting_id(self):
        t2 = _make_tournament(name="Third")
        Client().post(
            "/clock/api/me/register/",
            data='{"tournament_id": 1}',
            content_type="application/json",
            **self._old_auth("player3@example.com"),
        )
        r = Client().post(
            "/clock/api/me/register/",
            data=f'{{"tournament_id": {t2.id}}}',
            content_type="application/json",
            **self._old_auth("player3@example.com"),
        )
        assert r.json().get("conflictTournamentId") == 1

    def test_player_can_register_after_other_tournament_finishes(self):
        from clock.models import Tournament
        t2 = _make_tournament(name="After-finish")
        Client().post(
            "/clock/api/me/register/",
            data='{"tournament_id": 1}',
            content_type="application/json",
            **self._old_auth("player4@example.com"),
        )
        Tournament.objects.filter(pk=1).update(status=Tournament.STATUS_FINISHED)
        r = Client().post(
            "/clock/api/me/register/",
            data=f'{{"tournament_id": {t2.id}}}',
            content_type="application/json",
            **self._old_auth("player4@example.com"),
        )
        assert r.status_code == 201

    def test_cannot_register_in_finished_tournament(self):
        from clock.models import Tournament
        Tournament.objects.filter(pk=1).update(status=Tournament.STATUS_FINISHED)
        r = Client().post(
            "/clock/api/me/register/",
            data='{"tournament_id": 1}',
            content_type="application/json",
            **self._old_auth("player5@example.com"),
        )
        assert r.status_code == 409

    def test_register_nonexistent_tournament_returns_404(self):
        r = Client().post(
            "/clock/api/me/register/",
            data='{"tournament_id": 99999}',
            content_type="application/json",
            **self._old_auth("player6@example.com"),
        )
        assert r.status_code == 404
