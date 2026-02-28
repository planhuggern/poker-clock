"""
Tests for the Tournament REST API.

Endpoints:
  GET   /clock/api/tournaments/               list
  POST  /clock/api/tournaments/               admin create
  GET   /clock/api/tournaments/<id>/          detail
  PATCH /clock/api/tournaments/<id>/          admin rename
  POST  /clock/api/tournaments/<id>/finish/   admin finish
"""
import time
import pytest
import jwt as pyjwt

from django.test import Client

_SECRET = "test-jwt-secret"


def _token(username: str, role: str = "viewer") -> str:
    return pyjwt.encode(
        {"username": username, "role": role, "iat": int(time.time()), "exp": int(time.time()) + 3600},
        _SECRET, algorithm="HS256",
    )


def _auth(username: str = "user@example.com", role: str = "viewer") -> dict:
    return {"HTTP_AUTHORIZATION": f"Bearer {_token(username, role)}"}


def _admin() -> dict:
    return _auth("admin@example.com", "admin")


#  GET /clock/api/tournaments/ 

@pytest.mark.django_db
class TestTournamentList:

    def test_returns_200(self):
        r = Client().get("/clock/api/tournaments/")
        assert r.status_code == 200

    def test_returns_list(self):
        r = Client().get("/clock/api/tournaments/")
        assert isinstance(r.json(), list)

    def test_default_tournament_in_list(self):
        """The data migration always creates tournament id=1."""
        r = Client().get("/clock/api/tournaments/")
        ids = [t["id"] for t in r.json()]
        assert 1 in ids

    def test_filter_by_status(self):
        from clock.models import Tournament
        Tournament.objects.create(name="Ferdig", status=Tournament.STATUS_FINISHED, state_json={})
        r = Client().get("/clock/api/tournaments/?status=finished")
        data = r.json()
        assert all(t["status"] == "finished" for t in data)

    def test_tournament_entry_has_expected_fields(self):
        r = Client().get("/clock/api/tournaments/")
        t = next(x for x in r.json() if x["id"] == 1)
        for field in ("id", "name", "status", "created_at", "playerCount"):
            assert field in t, f"Missing field: {field}"


#  POST /clock/api/tournaments/ 

@pytest.mark.django_db
class TestTournamentCreate:

    def test_admin_can_create(self):
        r = Client().post(
            "/clock/api/tournaments/",
            data='{"name": "Ny turnering"}',
            content_type="application/json",
            **_admin(),
        )
        assert r.status_code == 201

    def test_create_response_has_id(self):
        r = Client().post(
            "/clock/api/tournaments/",
            data='{"name": "Test"}',
            content_type="application/json",
            **_admin(),
        )
        assert "id" in r.json()

    def test_viewer_cannot_create(self):
        r = Client().post(
            "/clock/api/tournaments/",
            data='{"name": "Ulovlig"}',
            content_type="application/json",
            **_auth(),
        )
        assert r.status_code == 403

    def test_unauthenticated_cannot_create(self):
        r = Client().post(
            "/clock/api/tournaments/",
            data='{"name": "Ulovlig"}',
            content_type="application/json",
        )
        assert r.status_code == 401

    def test_empty_name_returns_400(self):
        r = Client().post(
            "/clock/api/tournaments/",
            data='{"name": ""}',
            content_type="application/json",
            **_admin(),
        )
        assert r.status_code == 400

    def test_created_tournament_has_pending_status(self):
        r = Client().post(
            "/clock/api/tournaments/",
            data='{"name": "Ny turnering"}',
            content_type="application/json",
            **_admin(),
        )
        assert r.json()["status"] == "pending"

    def test_new_tournament_loaded_in_state_engine(self):
        from clock import state as gs
        r = Client().post(
            "/clock/api/tournaments/",
            data='{"name": "State-test"}',
            content_type="application/json",
            **_admin(),
        )
        tid = r.json()["id"]
        # Should be in memory now
        snap = gs.get_snapshot(tournament_id=tid)
        assert snap is not None


#  GET /clock/api/tournaments/<id>/ 

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


#  PATCH /clock/api/tournaments/<id>/ 

@pytest.mark.django_db
class TestTournamentPatch:

    def test_admin_can_rename(self):
        r = Client().patch(
            "/clock/api/tournaments/1/",
            data='{"name": "Renamed"}',
            content_type="application/json",
            **_admin(),
        )
        assert r.status_code == 200
        assert r.json()["name"] == "Renamed"

    def test_viewer_cannot_rename(self):
        r = Client().patch(
            "/clock/api/tournaments/1/",
            data='{"name": "Hacked"}',
            content_type="application/json",
            **_auth(),
        )
        assert r.status_code == 403

    def test_empty_name_returns_400(self):
        r = Client().patch(
            "/clock/api/tournaments/1/",
            data='{"name": ""}',
            content_type="application/json",
            **_admin(),
        )
        assert r.status_code == 400


#  POST /clock/api/tournaments/<id>/finish/ 

@pytest.mark.django_db
class TestTournamentFinish:

    def test_admin_can_finish(self):
        r = Client().post("/clock/api/tournaments/1/finish/", **_admin())
        assert r.status_code == 200

    def test_finish_sets_status_to_finished(self):
        r = Client().post("/clock/api/tournaments/1/finish/", **_admin())
        assert r.json()["status"] == "finished"

    def test_finish_already_finished_returns_409(self):
        from clock.models import Tournament
        Tournament.objects.filter(pk=1).update(status=Tournament.STATUS_FINISHED)
        r = Client().post("/clock/api/tournaments/1/finish/", **_admin())
        assert r.status_code == 409

    def test_finish_nonexistent_returns_404(self):
        r = Client().post("/clock/api/tournaments/99999/finish/", **_admin())
        assert r.status_code == 404

    def test_viewer_cannot_finish(self):
        r = Client().post("/clock/api/tournaments/1/finish/", **_auth())
        assert r.status_code == 403


#  Multi-tournament registration constraints 

@pytest.mark.django_db
class TestMultiTournamentRegistration:

    def _create_tournament(self, name: str = "Extra"):
        from clock.models import Tournament
        from clock import state as gs
        t = Tournament.objects.create(name=name, status=Tournament.STATUS_PENDING, state_json={})
        gs.init_state(None, tournament_id=t.id)
        return t

    def test_player_can_register_in_first_tournament(self):
        r = Client().post(
            "/clock/api/me/register/",
            data='{"tournament_id": 1}',
            content_type="application/json",
            **_auth("player1@example.com"),
        )
        assert r.status_code == 201

    def test_player_cannot_register_in_two_active_tournaments(self):
        t2 = self._create_tournament("Second")
        # Register in tournament 1
        Client().post(
            "/clock/api/me/register/",
            data='{"tournament_id": 1}',
            content_type="application/json",
            **_auth("player2@example.com"),
        )
        # Try to register in tournament 2
        r = Client().post(
            "/clock/api/me/register/",
            data=f'{{"tournament_id": {t2.id}}}',
            content_type="application/json",
            **_auth("player2@example.com"),
        )
        assert r.status_code == 409

    def test_conflict_response_includes_conflicting_id(self):
        t2 = self._create_tournament("Third")
        Client().post(
            "/clock/api/me/register/",
            data='{"tournament_id": 1}',
            content_type="application/json",
            **_auth("player3@example.com"),
        )
        r = Client().post(
            "/clock/api/me/register/",
            data=f'{{"tournament_id": {t2.id}}}',
            content_type="application/json",
            **_auth("player3@example.com"),
        )
        assert r.json().get("conflictTournamentId") == 1

    def test_player_can_register_after_other_tournament_finishes(self):
        from clock.models import Tournament
        t2 = self._create_tournament("After-finish")
        # Register in t1
        Client().post(
            "/clock/api/me/register/",
            data='{"tournament_id": 1}',
            content_type="application/json",
            **_auth("player4@example.com"),
        )
        # Mark t1 as finished
        Tournament.objects.filter(pk=1).update(status=Tournament.STATUS_FINISHED)
        # Should now be able to join t2
        r = Client().post(
            "/clock/api/me/register/",
            data=f'{{"tournament_id": {t2.id}}}',
            content_type="application/json",
            **_auth("player4@example.com"),
        )
        assert r.status_code == 201

    def test_cannot_register_in_finished_tournament(self):
        from clock.models import Tournament
        Tournament.objects.filter(pk=1).update(status=Tournament.STATUS_FINISHED)
        r = Client().post(
            "/clock/api/me/register/",
            data='{"tournament_id": 1}',
            content_type="application/json",
            **_auth("player5@example.com"),
        )
        assert r.status_code == 409

    def test_register_nonexistent_tournament_returns_404(self):
        r = Client().post(
            "/clock/api/me/register/",
            data='{"tournament_id": 99999}',
            content_type="application/json",
            **_auth("player6@example.com"),
        )
        assert r.status_code == 404
