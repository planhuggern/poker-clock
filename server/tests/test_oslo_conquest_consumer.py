from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator

from oslo_conquest.consumers import OsloConquestConsumer, _rooms


def ws_roundtrip(messages):
    async def run():
        communicator = WebsocketCommunicator(
            OsloConquestConsumer.as_asgi(),
            "/ws/oslo-conquest/",
        )
        connected, _ = await communicator.connect()
        assert connected

        responses = []
        for message in messages:
            await communicator.send_json_to(message)
            responses.append(await communicator.receive_json_from())

        await communicator.disconnect()
        return responses

    return async_to_sync(run)()


def setup_function():
    _rooms.clear()


def test_create_game_assigns_red_player():
    responses = ws_roundtrip(
        [
            {
                "type": "create_game",
                "room": "oslo-1",
                "player": {"id": "p1", "name": "Ola"},
            }
        ]
    )

    state = responses[-1]["state"]
    assert state["started"] is False
    assert state["phase"] == "waiting"
    assert state["players"][0]["id"] == "p1"
    assert state["players"][0]["side"] == "red"


def test_second_player_starts_game_with_initial_territories():
    async def run():
        first = WebsocketCommunicator(OsloConquestConsumer.as_asgi(), "/ws/oslo-conquest/")
        second = WebsocketCommunicator(OsloConquestConsumer.as_asgi(), "/ws/oslo-conquest/")
        assert (await first.connect())[0]
        assert (await second.connect())[0]

        await first.send_json_to(
            {"type": "create_game", "room": "oslo-1", "player": {"id": "p1", "name": "Ola"}}
        )
        await first.receive_json_from()

        await second.send_json_to(
            {"type": "join_game", "room": "oslo-1", "player": {"id": "p2", "name": "Kari"}}
        )
        first_snapshot = await first.receive_json_from()
        second_snapshot = await second.receive_json_from()

        await first.disconnect()
        await second.disconnect()
        return first_snapshot, second_snapshot

    first_snapshot, second_snapshot = async_to_sync(run)()
    assert first_snapshot == second_snapshot

    state = first_snapshot["state"]
    assert state["started"] is True
    assert state["phase"] == "playing"
    assert state["activePlayer"] == "red"
    assert state["players"][1]["side"] == "blue"
    assert state["territories"]["t0a"] == {"id": "t0a", "owner": "red", "units": 3}
    assert state["territories"]["t35"] == {"id": "t35", "owner": "blue", "units": 3}
    assert state["territories"]["t1"] == {"id": "t1", "owner": None, "units": 1}


def test_third_player_is_rejected_without_changing_room_state():
    ws_roundtrip(
        [
            {
                "type": "create_game",
                "room": "oslo-1",
                "player": {"id": "p1", "name": "Ola"},
            }
        ]
    )
    ws_roundtrip(
        [
            {
                "type": "join_game",
                "room": "oslo-1",
                "player": {"id": "p2", "name": "Kari"},
            }
        ]
    )

    responses = ws_roundtrip(
        [
            {
                "type": "join_game",
                "room": "oslo-1",
                "player": {"id": "p3", "name": "Per"},
            }
        ]
    )

    assert responses[0] == {"type": "error", "message": "Rommet er fullt"}
    assert [p["id"] for p in _rooms["oslo-1"]["players"]] == ["p1", "p2"]


def test_active_player_can_end_turn():
    async def run():
        first = WebsocketCommunicator(OsloConquestConsumer.as_asgi(), "/ws/oslo-conquest/")
        second = WebsocketCommunicator(OsloConquestConsumer.as_asgi(), "/ws/oslo-conquest/")
        assert (await first.connect())[0]
        assert (await second.connect())[0]

        await first.send_json_to(
            {"type": "create_game", "room": "oslo-1", "player": {"id": "p1", "name": "Ola"}}
        )
        await first.receive_json_from()
        await second.send_json_to(
            {"type": "join_game", "room": "oslo-1", "player": {"id": "p2", "name": "Kari"}}
        )
        await first.receive_json_from()
        await second.receive_json_from()

        await first.send_json_to({"type": "end_turn"})
        first_snapshot = await first.receive_json_from()
        second_snapshot = await second.receive_json_from()

        await first.disconnect()
        await second.disconnect()
        return first_snapshot, second_snapshot

    first_snapshot, second_snapshot = async_to_sync(run)()
    assert first_snapshot == second_snapshot
    assert first_snapshot["state"]["activePlayer"] == "blue"


def test_non_active_player_cannot_end_turn():
    async def run():
        first = WebsocketCommunicator(OsloConquestConsumer.as_asgi(), "/ws/oslo-conquest/")
        second = WebsocketCommunicator(OsloConquestConsumer.as_asgi(), "/ws/oslo-conquest/")
        assert (await first.connect())[0]
        assert (await second.connect())[0]

        await first.send_json_to(
            {"type": "create_game", "room": "oslo-1", "player": {"id": "p1", "name": "Ola"}}
        )
        await first.receive_json_from()
        await second.send_json_to(
            {"type": "join_game", "room": "oslo-1", "player": {"id": "p2", "name": "Kari"}}
        )
        await first.receive_json_from()
        await second.receive_json_from()

        await second.send_json_to({"type": "end_turn"})
        error = await second.receive_json_from()

        await first.disconnect()
        await second.disconnect()
        return error

    assert async_to_sync(run)() == {"type": "error", "message": "Det er ikke din tur"}
    assert _rooms["oslo-1"]["activePlayer"] == "red"


def test_game_action_cannot_overwrite_mvp_state():
    ws_roundtrip(
        [
            {
                "type": "create_game",
                "room": "oslo-1",
                "player": {"id": "p1", "name": "Ola"},
            }
        ]
    )
    ws_roundtrip(
        [
            {
                "type": "join_game",
                "room": "oslo-1",
                "player": {"id": "p2", "name": "Kari"},
            }
        ]
    )

    responses = ws_roundtrip(
        [
            {
                "type": "join_game",
                "room": "oslo-1",
                "player": {"id": "p1", "name": "Ola"},
            },
            {
                "type": "game_action",
                "state": {"room": "oslo-1", "activePlayer": "blue"},
            },
        ]
    )

    assert responses[1] == {"type": "error", "message": "Serveren styrer MVP-state"}
    assert _rooms["oslo-1"]["activePlayer"] == "red"


def test_list_rooms_returns_empty_list_when_no_rooms_exist():
    responses = ws_roundtrip([{"type": "list_rooms"}])

    assert responses[0] == {"type": "room_list", "rooms": []}


def test_list_rooms_includes_waiting_room_summary():
    ws_roundtrip(
        [
            {
                "type": "create_game",
                "room": "oslo-1",
                "player": {"id": "p1", "name": "Ola"},
            }
        ]
    )

    responses = ws_roundtrip([{"type": "list_rooms"}])

    assert responses[0] == {
        "type": "room_list",
        "rooms": [
            {
                "room": "oslo-1",
                "playerCount": 1,
                "maxPlayers": 2,
                "started": False,
                "phase": "waiting",
                "status": "waiting",
                "players": ["Ola"],
            }
        ],
    }


def test_list_rooms_marks_started_room_unavailable():
    ws_roundtrip(
        [
            {
                "type": "create_game",
                "room": "oslo-1",
                "player": {"id": "p1", "name": "Ola"},
            }
        ]
    )
    ws_roundtrip(
        [
            {
                "type": "join_game",
                "room": "oslo-1",
                "player": {"id": "p2", "name": "Kari"},
            }
        ]
    )

    responses = ws_roundtrip([{"type": "list_rooms"}])
    room = responses[0]["rooms"][0]

    assert room["room"] == "oslo-1"
    assert room["playerCount"] == 2
    assert room["maxPlayers"] == 2
    assert room["started"] is True
    assert room["phase"] == "playing"
    assert room["status"] == "started"
    assert room["players"] == ["Ola", "Kari"]
    assert "territories" not in room
