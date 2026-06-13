import json
import uuid

import pytest
from players.jwt import decode_token
from players.models import Player


@pytest.mark.django_db
class TestGuestCreate:
    URL = "/auth/guest/"

    def test_creates_player(self, client):
        resp = client.post(self.URL)
        assert resp.status_code == 201
        assert Player.objects.count() == 1

    def test_response_contains_required_keys(self, client):
        data = client.post(self.URL).json()
        assert "access" in data
        assert "refresh" in data
        assert "player" in data

    def test_player_id_exists_in_db(self, client):
        data = client.post(self.URL).json()
        player_id = uuid.UUID(data["player"]["id"])
        assert Player.objects.filter(pk=player_id).exists()

    def test_player_is_guest(self, client):
        data = client.post(self.URL).json()
        assert data["player"]["is_guest"] is True

    def test_display_name_starts_with_guest(self, client):
        data = client.post(self.URL).json()
        assert data["player"]["display_name"].startswith("Gjest ")


@pytest.mark.django_db
class TestTokenRefresh:
    GUEST_URL = "/auth/guest/"
    REFRESH_URL = "/auth/refresh/"

    def _get_tokens(self, client):
        return client.post(self.GUEST_URL).json()

    def test_valid_refresh_returns_access_token(self, client):
        tokens = self._get_tokens(client)
        resp = client.post(
            self.REFRESH_URL,
            data=json.dumps({"refresh": tokens["refresh"]}),
            content_type="application/json",
        )
        assert resp.status_code == 200
        assert "access" in resp.json()

    def test_invalid_refresh_token_returns_401(self, client):
        resp = client.post(
            self.REFRESH_URL,
            data=json.dumps({"refresh": "not.a.valid.token"}),
            content_type="application/json",
        )
        assert resp.status_code == 401

    def test_using_access_token_as_refresh_fails(self, client):
        tokens = self._get_tokens(client)
        resp = client.post(
            self.REFRESH_URL,
            data=json.dumps({"refresh": tokens["access"]}),
            content_type="application/json",
        )
        assert resp.status_code == 401

    def test_missing_refresh_key_returns_400(self, client):
        resp = client.post(
            self.REFRESH_URL,
            data=json.dumps({}),
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_refresh_updates_last_seen_at(self, client):
        tokens = self._get_tokens(client)
        player_id = uuid.UUID(tokens["player"]["id"])
        assert Player.objects.get(pk=player_id).last_seen_at is None

        client.post(
            self.REFRESH_URL,
            data=json.dumps({"refresh": tokens["refresh"]}),
            content_type="application/json",
        )
        assert Player.objects.get(pk=player_id).last_seen_at is not None


@pytest.mark.django_db
class TestAccessTokenValidation:
    def test_access_token_decodes_to_correct_player(self, client):
        data = client.post("/auth/guest/").json()
        payload = decode_token(data["access"])

        assert payload is not None
        assert payload["token_type"] == "access"
        assert payload["player_id"] == data["player"]["id"]
        assert Player.objects.filter(pk=uuid.UUID(payload["player_id"])).exists()
