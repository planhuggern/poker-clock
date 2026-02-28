"""
TDD tests for the Player registration API.

Endpoints:
  GET  /clock/api/me/            – get/create own player profile
  PATCH /clock/api/me/           – update nickname
  POST  /clock/api/me/register/  – join the current tournament
  GET  /clock/api/players/       – list all registered players

Run:
  cd server && .venv/Scripts/pytest tests/test_player_api.py -v
"""
import time
import pytest
import jwt as pyjwt

from django.test import Client

# ── JWT helpers ────────────────────────────────────────────────────────────────

_SECRET = "test-jwt-secret"   # matches tests/settings.py CONFIG["jwtSecret"]


def _token(username: str = "user@example.com", role: str = "viewer") -> str:
    return pyjwt.encode(
        {"username": username, "role": role,
         "iat": int(time.time()), "exp": int(time.time()) + 3600},
        _SECRET, algorithm="HS256",
    )


def _auth(username: str = "user@example.com", role: str = "viewer") -> dict:
    """Return headers dict with a valid Bearer token."""
    return {"HTTP_AUTHORIZATION": f"Bearer {_token(username, role)}"}


# ── GET /clock/api/me/ ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestMeGet:

    def test_returns_200_with_valid_token(self):
        c = Client()
        r = c.get("/clock/api/me/", **_auth())
        assert r.status_code == 200

    def test_returns_401_without_token(self):
        c = Client()
        r = c.get("/clock/api/me/")
        assert r.status_code == 401

    def test_returns_401_with_invalid_token(self):
        c = Client()
        r = c.get("/clock/api/me/",
                  HTTP_AUTHORIZATION="Bearer this.is.garbage")
        assert r.status_code == 401

    def test_response_contains_expected_keys(self):
        c = Client()
        r = c.get("/clock/api/me/", **_auth("alice@example.com"))
        data = r.json()
        assert "username" in data
        assert "nickname" in data
        assert "registered" in data   # whether player has joined tournament

    def test_username_matches_token_subject(self):
        c = Client()
        r = c.get("/clock/api/me/", **_auth("bob@example.com"))
        assert r.json()["username"] == "bob@example.com"

    def test_default_nickname_is_username(self):
        """A brand-new player's nickname defaults to their username."""
        c = Client()
        r = c.get("/clock/api/me/", **_auth("carol@example.com"))
        data = r.json()
        assert data["nickname"] == "carol@example.com"

    def test_second_get_does_not_create_duplicate(self):
        """Calling GET twice must return the same player, not two objects."""
        from clock.models import Player

        c = Client()
        c.get("/clock/api/me/", **_auth("dave@example.com"))
        c.get("/clock/api/me/", **_auth("dave@example.com"))
        assert Player.objects.filter(username="dave@example.com").count() == 1

    def test_registered_false_before_register(self):
        c = Client()
        r = c.get("/clock/api/me/", **_auth("eve@example.com"))
        assert r.json()["registered"] is False


# ── PATCH /clock/api/me/ ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestMePatch:

    def test_patch_updates_nickname(self):
        c = Client()
        c.get("/clock/api/me/", **_auth("frank@example.com"))   # create
        r = c.patch(
            "/clock/api/me/",
            data='{"nickname": "BigBlind"}',
            content_type="application/json",
            **_auth("frank@example.com"),
        )
        assert r.status_code == 200
        assert r.json()["nickname"] == "BigBlind"

    def test_nickname_persists_on_next_get(self):
        c = Client()
        headers = _auth("grace@example.com")
        c.patch("/clock/api/me/",
                data='{"nickname": "GraceAce"}',
                content_type="application/json",
                **headers)
        r = c.get("/clock/api/me/", **headers)
        assert r.json()["nickname"] == "GraceAce"

    def test_patch_returns_401_without_token(self):
        c = Client()
        r = c.patch("/clock/api/me/",
                    data='{"nickname": "X"}',
                    content_type="application/json")
        assert r.status_code == 401

    def test_patch_blank_nickname_returns_400(self):
        c = Client()
        c.get("/clock/api/me/", **_auth("hank@example.com"))
        r = c.patch("/clock/api/me/",
                    data='{"nickname": ""}',
                    content_type="application/json",
                    **_auth("hank@example.com"))
        assert r.status_code == 400

    def test_patch_whitespace_only_nickname_returns_400(self):
        c = Client()
        c.get("/clock/api/me/", **_auth("ima@example.com"))
        r = c.patch("/clock/api/me/",
                    data='{"nickname": "   "}',
                    content_type="application/json",
                    **_auth("ima@example.com"))
        assert r.status_code == 400

    def test_patch_nickname_too_long_returns_400(self):
        c = Client()
        headers = _auth("jack@example.com")
        c.get("/clock/api/me/", **headers)
        r = c.patch("/clock/api/me/",
                    data=f'{{"nickname": "{"x" * 65}"}}',
                    content_type="application/json",
                    **headers)
        assert r.status_code == 400

    def test_patch_nickname_max_length_is_ok(self):
        c = Client()
        headers = _auth("kate@example.com")
        c.get("/clock/api/me/", **headers)
        r = c.patch("/clock/api/me/",
                    data=f'{{"nickname": "{"x" * 64}"}}',
                    content_type="application/json",
                    **headers)
        assert r.status_code == 200

    def test_patch_missing_nickname_field_returns_400(self):
        c = Client()
        headers = _auth("lee@example.com")
        c.get("/clock/api/me/", **headers)
        r = c.patch("/clock/api/me/",
                    data='{"other": "stuff"}',
                    content_type="application/json",
                    **headers)
        assert r.status_code == 400

    def test_player_cannot_patch_another_players_profile(self):
        """The endpoint always operates on the token owner, not a passed username."""
        c = Client()
        c.get("/clock/api/me/", **_auth("mark@example.com"))
        # Logging in as nina while trying to set mark's nick via body — should
        # only affect nina (separate player record).
        c.patch("/clock/api/me/",
                data='{"nickname": "HijackAttempt"}',
                content_type="application/json",
                **_auth("nina@example.com"))
        from clock.models import Player
        mark = Player.objects.get(username="mark@example.com")
        assert mark.nickname != "HijackAttempt"


# ── POST /clock/api/me/register/ ──────────────────────────────────────────────

@pytest.mark.django_db
class TestRegister:

    def test_register_returns_201(self):
        c = Client()
        r = c.post("/clock/api/me/register/",
                   content_type="application/json",
                   **_auth("oscar@example.com"))
        assert r.status_code == 201

    def test_register_returns_401_without_token(self):
        c = Client()
        r = c.post("/clock/api/me/register/", content_type="application/json")
        assert r.status_code == 401

    def test_register_creates_tournament_entry(self):
        from clock.models import TournamentEntry
        c = Client()
        c.post("/clock/api/me/register/",
               content_type="application/json",
               **_auth("pat@example.com"))
        assert TournamentEntry.objects.filter(
            player__username="pat@example.com", is_active=True
        ).exists()

    def test_register_second_time_is_idempotent_returns_200(self):
        """Second register must be idempotent — no duplicate entry, status 200."""
        from clock.models import TournamentEntry
        c = Client()
        headers = _auth("quinn@example.com")
        c.post("/clock/api/me/register/", content_type="application/json", **headers)
        r = c.post("/clock/api/me/register/", content_type="application/json", **headers)
        assert r.status_code == 200
        assert TournamentEntry.objects.filter(player__username="quinn@example.com").count() == 1

    def test_register_marks_me_as_registered(self):
        """After registration, GET /me/ must return registered=True."""
        c = Client()
        headers = _auth("rita@example.com")
        c.post("/clock/api/me/register/", content_type="application/json", **headers)
        r = c.get("/clock/api/me/", **headers)
        assert r.json()["registered"] is True

    def test_register_response_contains_player_data(self):
        c = Client()
        r = c.post("/clock/api/me/register/",
                   content_type="application/json",
                   **_auth("sam@example.com"))
        data = r.json()
        assert "player" in data
        assert data["player"]["username"] == "sam@example.com"

    def test_register_auto_creates_player_on_first_visit(self):
        """Player object must be created even if GET /me/ was never called."""
        from clock.models import Player
        c = Client()
        c.post("/clock/api/me/register/",
               content_type="application/json",
               **_auth("tina@example.com"))
        assert Player.objects.filter(username="tina@example.com").exists()


# ── GET /clock/api/players/ ───────────────────────────────────────────────────

@pytest.mark.django_db
class TestPlayerList:

    def _register(self, username: str, nickname: str | None = None) -> None:
        c = Client()
        c.post("/clock/api/me/register/",
               content_type="application/json",
               **_auth(username))
        if nickname:
            c.patch("/clock/api/me/",
                    data=f'{{"nickname": "{nickname}"}}',
                    content_type="application/json",
                    **_auth(username))

    def test_returns_200(self):
        c = Client()
        r = c.get("/clock/api/players/")
        assert r.status_code == 200

    def test_returns_list(self):
        c = Client()
        r = c.get("/clock/api/players/")
        assert isinstance(r.json(), list)

    def test_lists_registered_players(self):
        self._register("uma@example.com", "Uma")
        self._register("vic@example.com", "Vic")
        c = Client()
        r = c.get("/clock/api/players/")
        usernames = [p["username"] for p in r.json()]
        assert "uma@example.com" in usernames
        assert "vic@example.com" in usernames

    def test_unregistered_player_not_in_list(self):
        # Just call GET /me/ — no register
        c = Client()
        c.get("/clock/api/me/", **_auth("will@example.com"))
        r = c.get("/clock/api/players/")
        usernames = [p["username"] for p in r.json()]
        assert "will@example.com" not in usernames

    def test_response_entries_have_expected_fields(self):
        self._register("xena@example.com", "Xena")
        c = Client()
        r = c.get("/clock/api/players/")
        players = r.json()
        entry = next(p for p in players if p["username"] == "xena@example.com")
        for field in ("username", "nickname", "is_active", "joined_at"):
            assert field in entry, f"Missing field: {field}"

    def test_nickname_in_list_response(self):
        self._register("yuki@example.com", "YukiSan")
        c = Client()
        r = c.get("/clock/api/players/")
        entry = next(p for p in r.json() if p["username"] == "yuki@example.com")
        assert entry["nickname"] == "YukiSan"

    def test_active_players_have_is_active_true(self):
        self._register("zara@example.com")
        c = Client()
        r = c.get("/clock/api/players/")
        entry = next(p for p in r.json() if p["username"] == "zara@example.com")
        assert entry["is_active"] is True

    def test_unauthenticated_can_view_list(self):
        """Player list is public (for TV display)."""
        c = Client()
        r = c.get("/clock/api/players/")
        assert r.status_code == 200
