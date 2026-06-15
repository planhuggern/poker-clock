"""
Tests for ClockConsumer admin check.

Admin access is restricted to the tournament host (the players.Player who created it).
Non-hosts and tournaments without a host get an error_msg response.
"""
import pytest
from asgiref.sync import async_to_sync
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator

from clock.routing import websocket_urlpatterns
from clock import state as gs
from players.jwt import sign_access_token


def _communicator(tournament_id: int, token: str) -> WebsocketCommunicator:
    return WebsocketCommunicator(
        URLRouter(websocket_urlpatterns),
        f"/ws/clock/{tournament_id}/?token={token}",
    )


def _run(coro):
    return async_to_sync(coro)()


# ── connection ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_authenticated_player_can_connect():
    from players.models import Player
    from clock.models import Tournament

    async def run():
        host = await Player.objects.acreate(display_name="Host")
        t = await Tournament.objects.acreate(name="T", host=host)
        gs.init_state(None, tournament_id=t.id)

        comm = _communicator(t.id, sign_access_token(host.id))
        connected, _ = await comm.connect()
        assert connected

        snap = await comm.receive_json_from()
        assert snap["type"] == "snapshot"
        await comm.disconnect()

    _run(run)


@pytest.mark.django_db(transaction=True)
def test_invalid_token_is_rejected():
    from clock.models import Tournament

    async def run():
        t = await Tournament.objects.acreate(name="T")
        gs.init_state(None, tournament_id=t.id)

        comm = _communicator(t.id, "not.a.valid.token")
        connected, code = await comm.connect()
        assert not connected
        assert code == 4001

    _run(run)


# ── admin actions: host ────────────────────────────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_host_can_execute_admin_start():
    from players.models import Player
    from clock.models import Tournament

    async def run():
        host = await Player.objects.acreate(display_name="Host")
        t = await Tournament.objects.acreate(name="T", host=host)
        gs.init_state(None, tournament_id=t.id)

        comm = _communicator(t.id, sign_access_token(host.id))
        connected, _ = await comm.connect()
        assert connected
        await comm.receive_json_from()  # initial snapshot

        await comm.send_json_to({"type": "admin_start"})
        response = await comm.receive_json_from()
        assert response["type"] == "snapshot", f"Expected snapshot, got {response}"
        assert response.get("running") is True
        await comm.disconnect()

    _run(run)


@pytest.mark.django_db(transaction=True)
def test_host_can_execute_admin_pause():
    from players.models import Player
    from clock.models import Tournament

    async def _drain_until(comm, msg_type: str, limit: int = 5):
        for _ in range(limit):
            msg = await comm.receive_json_from()
            if msg["type"] == msg_type:
                return msg
        raise AssertionError(f"Expected message type {msg_type!r} not received in {limit} messages")

    async def run():
        host = await Player.objects.acreate(display_name="Host")
        t = await Tournament.objects.acreate(name="T", host=host)
        gs.init_state(None, tournament_id=t.id)

        comm = _communicator(t.id, sign_access_token(host.id))
        connected, _ = await comm.connect()
        assert connected
        await comm.receive_json_from()  # initial snapshot

        await comm.send_json_to({"type": "admin_start"})
        await _drain_until(comm, "snapshot")  # snapshot from admin_start (skip play_sound)

        await comm.send_json_to({"type": "admin_pause"})
        snap = await _drain_until(comm, "snapshot")  # snapshot from admin_pause
        assert snap.get("running") is False
        await comm.disconnect()

    _run(run)


# ── admin actions: non-host ────────────────────────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_non_host_gets_error_msg_for_admin_start():
    from players.models import Player
    from clock.models import Tournament

    async def run():
        host = await Player.objects.acreate(display_name="Host")
        other = await Player.objects.acreate(display_name="Other")
        t = await Tournament.objects.acreate(name="T", host=host)
        gs.init_state(None, tournament_id=t.id)

        comm = _communicator(t.id, sign_access_token(other.id))
        connected, _ = await comm.connect()
        assert connected
        await comm.receive_json_from()  # initial snapshot

        await comm.send_json_to({"type": "admin_start"})
        response = await comm.receive_json_from()
        assert response["type"] == "error_msg"
        await comm.disconnect()

    _run(run)


@pytest.mark.django_db(transaction=True)
def test_non_host_admin_action_does_not_change_state():
    from players.models import Player
    from clock.models import Tournament

    async def run():
        host = await Player.objects.acreate(display_name="Host")
        other = await Player.objects.acreate(display_name="Other")
        t = await Tournament.objects.acreate(name="T", host=host)
        gs.init_state(None, tournament_id=t.id)

        comm = _communicator(t.id, sign_access_token(other.id))
        connected, _ = await comm.connect()
        assert connected
        await comm.receive_json_from()  # initial snapshot

        await comm.send_json_to({"type": "admin_start"})
        await comm.receive_json_from()  # error_msg

        # State must not have changed — clock should still not be running
        snap = gs.get_snapshot(tournament_id=t.id)
        assert snap.get("running") is False
        await comm.disconnect()

    _run(run)


@pytest.mark.django_db(transaction=True)
def test_non_host_can_still_receive_snapshots():
    from players.models import Player
    from clock.models import Tournament

    async def run():
        host = await Player.objects.acreate(display_name="Host")
        viewer = await Player.objects.acreate(display_name="Viewer")
        t = await Tournament.objects.acreate(name="T", host=host)
        gs.init_state(None, tournament_id=t.id)

        comm = _communicator(t.id, sign_access_token(viewer.id))
        connected, _ = await comm.connect()
        assert connected

        snap = await comm.receive_json_from()
        assert snap["type"] == "snapshot"
        await comm.disconnect()

    _run(run)


# ── tournament without host ────────────────────────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_tournament_without_host_denies_admin_action():
    from players.models import Player
    from clock.models import Tournament

    async def run():
        player = await Player.objects.acreate(display_name="Player")
        t = await Tournament.objects.acreate(name="No host", host=None)
        gs.init_state(None, tournament_id=t.id)

        comm = _communicator(t.id, sign_access_token(player.id))
        connected, _ = await comm.connect()
        assert connected
        await comm.receive_json_from()  # initial snapshot

        await comm.send_json_to({"type": "admin_start"})
        response = await comm.receive_json_from()
        assert response["type"] == "error_msg"
        await comm.disconnect()

    _run(run)
