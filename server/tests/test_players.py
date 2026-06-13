import uuid
import pytest
from django.utils import timezone
from players.models import Player


@pytest.mark.django_db
class TestPlayerModel:
    def test_create_player(self):
        p = Player.objects.create(display_name="Ola Nordmann")
        assert p.pk is not None

    def test_id_is_uuid(self):
        p = Player.objects.create(display_name="Kari")
        assert isinstance(p.id, uuid.UUID)

    def test_is_guest_default_true(self):
        p = Player.objects.create(display_name="Gjest")
        assert p.is_guest is True

    def test_display_name_stored(self):
        p = Player.objects.create(display_name="Test Spiller")
        fetched = Player.objects.get(pk=p.pk)
        assert fetched.display_name == "Test Spiller"

    def test_last_seen_at_nullable(self):
        p = Player.objects.create(display_name="Anonym")
        assert p.last_seen_at is None

    def test_last_seen_at_can_be_set(self):
        now = timezone.now()
        p = Player.objects.create(display_name="Aktiv", last_seen_at=now)
        fetched = Player.objects.get(pk=p.pk)
        assert fetched.last_seen_at is not None

    def test_is_guest_can_be_false(self):
        p = Player.objects.create(display_name="Autentisert", is_guest=False)
        assert p.is_guest is False

    def test_str_returns_display_name(self):
        p = Player.objects.create(display_name="Spillernavn")
        assert str(p) == "Spillernavn"
