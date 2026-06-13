from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator

from oslo_conquest.consumers import OsloConquestConsumer, _rooms


async def connect_consumer():
    communicator = WebsocketCommunicator(
        OsloConquestConsumer.as_asgi(),
        "/ws/oslo-conquest/",
    )
    connected, _ = await communicator.connect()
    assert connected
    initial_message = await communicator.receive_json_from()
    assert initial_message["type"] == "room_list"
    return communicator


async def receive_type(communicator, message_type: str):
    for _ in range(10):
        message = await communicator.receive_json_from()
        if message["type"] == message_type:
            return message
    raise AssertionError(f"Expected websocket message type {message_type!r}")


async def receive_non_room_list(communicator):
    for _ in range(10):
        message = await communicator.receive_json_from()
        if message["type"] != "room_list":
            return message
    raise AssertionError("Expected non-room_list websocket message")


def ws_roundtrip(messages):
    async def run():
        communicator = await connect_consumer()

        responses = []
        for message in messages:
            await communicator.send_json_to(message)
            if message["type"] == "list_rooms":
                responses.append(await receive_type(communicator, "room_list"))
            else:
                responses.append(await receive_non_room_list(communicator))

        await communicator.disconnect()
        return responses

    return async_to_sync(run)()


def setup_function():
    _rooms.clear()


async def _complete_setup_round(first, second):
    await first.send_json_to(
        {"type": "choose_start_checkpoint", "checkpointTerritoryId": "lørenskog_cp"}
    )
    await receive_non_room_list(first)
    await receive_non_room_list(second)

    await first.send_json_to({"type": "end_turn"})
    await receive_non_room_list(first)
    await receive_non_room_list(second)

    await second.send_json_to(
        {"type": "choose_start_checkpoint", "checkpointTerritoryId": "lysaker_cp"}
    )
    await receive_non_room_list(first)
    await receive_non_room_list(second)

    await second.send_json_to({"type": "end_turn"})
    await receive_non_room_list(first)
    await receive_non_room_list(second)


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
        first = await connect_consumer()
        second = await connect_consumer()

        await first.send_json_to(
            {"type": "create_game", "room": "oslo-1", "player": {"id": "p1", "name": "Ola"}}
        )
        await receive_non_room_list(first)

        await second.send_json_to(
            {"type": "join_game", "room": "oslo-1", "player": {"id": "p2", "name": "Kari"}}
        )
        first_snapshot = await receive_non_room_list(first)
        second_snapshot = await receive_non_room_list(second)

        await first.disconnect()
        await second.disconnect()
        return first_snapshot, second_snapshot

    first_snapshot, second_snapshot = async_to_sync(run)()
    assert first_snapshot == second_snapshot

    state = first_snapshot["state"]
    assert state["started"] is True
    assert state["phase"] == "setup"
    assert state["activePlayer"] == "red"
    assert state["players"][1]["side"] == "blue"
    assert state["players"][0]["position"] is None
    assert state["players"][1]["position"] is None
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


def test_player_cannot_create_second_waiting_room():
    ws_roundtrip(
        [
            {
                "type": "create_game",
                "room": "oslo-1",
                "player": {"id": "p1", "name": "Ola"},
            }
        ]
    )

    responses = ws_roundtrip(
        [
            {
                "type": "create_game",
                "room": "oslo-2",
                "player": {"id": "p1", "name": "Ola"},
            }
        ]
    )

    assert responses[0] == {
        "type": "error",
        "message": 'Du er allerede med i rom "oslo-1".',
    }
    assert sorted(_rooms.keys()) == ["oslo-1"]


def test_player_cannot_create_room_when_already_in_started_game():
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
                "type": "create_game",
                "room": "oslo-2",
                "player": {"id": "p1", "name": "Ola"},
            }
        ]
    )

    assert responses[0] == {
        "type": "error",
        "message": 'Du er allerede med i rom "oslo-1".',
    }
    assert sorted(_rooms.keys()) == ["oslo-1"]
    assert _rooms["oslo-1"]["started"] is True


def test_player_cannot_join_second_room():
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
                "type": "create_game",
                "room": "oslo-2",
                "player": {"id": "p2", "name": "Kari"},
            }
        ]
    )

    responses = ws_roundtrip(
        [
            {
                "type": "join_game",
                "room": "oslo-2",
                "player": {"id": "p1", "name": "Ola"},
            }
        ]
    )

    assert responses[0] == {
        "type": "error",
        "message": 'Du er allerede med i rom "oslo-1".',
    }
    assert [p["id"] for p in _rooms["oslo-2"]["players"]] == ["p2"]


def test_active_player_can_end_turn():
    async def run():
        first = await connect_consumer()
        second = await connect_consumer()

        await first.send_json_to(
            {"type": "create_game", "room": "oslo-1", "player": {"id": "p1", "name": "Ola"}}
        )
        await receive_non_room_list(first)
        await second.send_json_to(
            {"type": "join_game", "room": "oslo-1", "player": {"id": "p2", "name": "Kari"}}
        )
        await receive_non_room_list(first)
        await receive_non_room_list(second)

        await _complete_setup_round(first, second)

        await first.send_json_to({"type": "end_turn"})
        first_snapshot = await receive_non_room_list(first)
        second_snapshot = await receive_non_room_list(second)

        await first.disconnect()
        await second.disconnect()
        return first_snapshot, second_snapshot

    first_snapshot, second_snapshot = async_to_sync(run)()
    assert first_snapshot == second_snapshot
    assert first_snapshot["state"]["activePlayer"] == "blue"


def test_non_active_player_cannot_end_turn():
    async def run():
        first = await connect_consumer()
        second = await connect_consumer()

        await first.send_json_to(
            {"type": "create_game", "room": "oslo-1", "player": {"id": "p1", "name": "Ola"}}
        )
        await receive_non_room_list(first)
        await second.send_json_to(
            {"type": "join_game", "room": "oslo-1", "player": {"id": "p2", "name": "Kari"}}
        )
        await receive_non_room_list(first)
        await receive_non_room_list(second)

        await _complete_setup_round(first, second)

        await second.send_json_to({"type": "end_turn"})
        error = await receive_non_room_list(second)

        await first.disconnect()
        await second.disconnect()
        return error

    assert async_to_sync(run)() == {"type": "error", "message": "Det er ikke din tur"}
    assert _rooms["oslo-1"]["activePlayer"] == "red"


def test_active_player_can_attack_with_deterministic_mvp_rules():
    async def run():
        first = await connect_consumer()
        second = await connect_consumer()

        await first.send_json_to(
            {"type": "create_game", "room": "oslo-1", "player": {"id": "p1", "name": "Ola"}}
        )
        await receive_non_room_list(first)
        await second.send_json_to(
            {"type": "join_game", "room": "oslo-1", "player": {"id": "p2", "name": "Kari"}}
        )
        await receive_non_room_list(first)
        await receive_non_room_list(second)

        await _complete_setup_round(first, second)

        await first.send_json_to({"type": "attack", "fromTerritoryId": "t0a", "toTerritoryId": "t1"})
        first_snapshot = await receive_non_room_list(first)
        second_snapshot = await receive_non_room_list(second)

        await first.disconnect()
        await second.disconnect()
        return first_snapshot, second_snapshot

    first_snapshot, second_snapshot = async_to_sync(run)()
    assert first_snapshot == second_snapshot

    state = first_snapshot["state"]
    assert state["territories"]["t0a"]["owner"] == "red"
    assert state["territories"]["t0a"]["units"] == 2
    assert state["territories"]["t1"]["owner"] == "red"
    assert state["territories"]["t1"]["units"] == 1


def test_attack_rejects_non_neighbor_territories():
    async def run():
        first = await connect_consumer()
        second = await connect_consumer()

        await first.send_json_to(
            {"type": "create_game", "room": "oslo-1", "player": {"id": "p1", "name": "Ola"}}
        )
        await receive_non_room_list(first)
        await second.send_json_to(
            {"type": "join_game", "room": "oslo-1", "player": {"id": "p2", "name": "Kari"}}
        )
        await receive_non_room_list(first)
        await receive_non_room_list(second)

        await _complete_setup_round(first, second)

        await first.send_json_to({"type": "attack", "fromTerritoryId": "t0a", "toTerritoryId": "t35"})
        error = await receive_non_room_list(first)

        await first.disconnect()
        await second.disconnect()
        return error

    assert async_to_sync(run)() == {"type": "error", "message": "Territoriene er ikke naboer"}


def test_active_player_can_roll_dice_and_get_valid_moves():
    async def run():
        first = await connect_consumer()
        second = await connect_consumer()

        await first.send_json_to(
            {"type": "create_game", "room": "oslo-1", "player": {"id": "p1", "name": "Ola"}}
        )
        await receive_non_room_list(first)
        await second.send_json_to(
            {"type": "join_game", "room": "oslo-1", "player": {"id": "p2", "name": "Kari"}}
        )
        await receive_non_room_list(first)
        await receive_non_room_list(second)

        await _complete_setup_round(first, second)

        await first.send_json_to({"type": "roll_dice"})
        first_snapshot = await receive_non_room_list(first)
        second_snapshot = await receive_non_room_list(second)

        await first.disconnect()
        await second.disconnect()
        return first_snapshot, second_snapshot

    first_snapshot, second_snapshot = async_to_sync(run)()
    assert first_snapshot == second_snapshot

    red = next(player for player in first_snapshot["state"]["players"] if player["side"] == "red")
    assert 1 <= red["diceRoll"] <= 6
    assert red["movesRemaining"] == red["diceRoll"]
    assert isinstance(red["validMoves"], list)
    assert len(red["validMoves"]) > 0


def test_active_player_can_move_to_territory_in_valid_moves():
    async def run():
        first = await connect_consumer()
        second = await connect_consumer()

        await first.send_json_to(
            {"type": "create_game", "room": "oslo-1", "player": {"id": "p1", "name": "Ola"}}
        )
        await receive_non_room_list(first)
        await second.send_json_to(
            {"type": "join_game", "room": "oslo-1", "player": {"id": "p2", "name": "Kari"}}
        )
        await receive_non_room_list(first)
        await receive_non_room_list(second)

        await _complete_setup_round(first, second)

        await first.send_json_to({"type": "roll_dice"})
        first_after_roll = await receive_non_room_list(first)
        await receive_non_room_list(second)
        red = next(player for player in first_after_roll["state"]["players"] if player["side"] == "red")
        destination = red["validMoves"][0]

        await first.send_json_to({"type": "move", "toTerritoryId": destination})
        first_after_move = await receive_non_room_list(first)
        second_after_move = await receive_non_room_list(second)

        await first.disconnect()
        await second.disconnect()
        return first_after_move, second_after_move, destination

    first_snapshot, second_snapshot, destination = async_to_sync(run)()
    assert first_snapshot == second_snapshot
    red = next(player for player in first_snapshot["state"]["players"] if player["side"] == "red")
    assert red["position"] == destination
    assert red["movesRemaining"] == 0
    assert red["validMoves"] == []


def test_move_rejects_territory_outside_valid_moves():
    async def run():
        first = await connect_consumer()
        second = await connect_consumer()

        await first.send_json_to(
            {"type": "create_game", "room": "oslo-1", "player": {"id": "p1", "name": "Ola"}}
        )
        await receive_non_room_list(first)
        await second.send_json_to(
            {"type": "join_game", "room": "oslo-1", "player": {"id": "p2", "name": "Kari"}}
        )
        await receive_non_room_list(first)
        await receive_non_room_list(second)

        await _complete_setup_round(first, second)

        await first.send_json_to({"type": "roll_dice"})
        await receive_non_room_list(first)
        await receive_non_room_list(second)

        await first.send_json_to({"type": "move", "toTerritoryId": "lørenskog_cp"})
        error = await receive_non_room_list(first)

        await first.disconnect()
        await second.disconnect()
        return error

    assert async_to_sync(run)() == {
        "type": "error",
        "message": "Territoriet er utenfor rekkevidde",
    }


def test_move_requires_dice_roll_without_changing_state():
    async def run():
        first = await connect_consumer()
        second = await connect_consumer()

        await first.send_json_to(
            {"type": "create_game", "room": "oslo-1", "player": {"id": "p1", "name": "Ola"}}
        )
        await receive_non_room_list(first)
        await second.send_json_to(
            {"type": "join_game", "room": "oslo-1", "player": {"id": "p2", "name": "Kari"}}
        )
        await receive_non_room_list(first)
        await receive_non_room_list(second)

        await _complete_setup_round(first, second)
        original_position = next(
            player for player in _rooms["oslo-1"]["players"] if player["side"] == "red"
        )["position"]

        await first.send_json_to({"type": "move", "toTerritoryId": "t0a"})
        error = await receive_non_room_list(first)

        await first.disconnect()
        await second.disconnect()
        return error, original_position

    error, original_position = async_to_sync(run)()
    red = next(player for player in _rooms["oslo-1"]["players"] if player["side"] == "red")
    assert error == {"type": "error", "message": "Du må kaste terning først"}
    assert red["position"] == original_position
    assert red["movesRemaining"] == 0
    assert red["validMoves"] == []


def test_non_active_player_cannot_move_after_active_player_rolls():
    async def run():
        first = await connect_consumer()
        second = await connect_consumer()

        await first.send_json_to(
            {"type": "create_game", "room": "oslo-1", "player": {"id": "p1", "name": "Ola"}}
        )
        await receive_non_room_list(first)
        await second.send_json_to(
            {"type": "join_game", "room": "oslo-1", "player": {"id": "p2", "name": "Kari"}}
        )
        await receive_non_room_list(first)
        await receive_non_room_list(second)

        await _complete_setup_round(first, second)

        await first.send_json_to({"type": "roll_dice"})
        await receive_non_room_list(first)
        await receive_non_room_list(second)

        blue_before = next(
            player for player in _rooms["oslo-1"]["players"] if player["side"] == "blue"
        )["position"]

        await second.send_json_to({"type": "move", "toTerritoryId": "t0a"})
        error = await receive_non_room_list(second)

        await first.disconnect()
        await second.disconnect()
        return error, blue_before

    error, blue_before = async_to_sync(run)()
    blue = next(player for player in _rooms["oslo-1"]["players"] if player["side"] == "blue")
    assert error == {"type": "error", "message": "Det er ikke din tur"}
    assert blue["position"] == blue_before


def test_player_can_choose_start_checkpoint_before_roll():
    async def run():
        first = await connect_consumer()
        second = await connect_consumer()

        await first.send_json_to(
            {"type": "create_game", "room": "oslo-1", "player": {"id": "p1", "name": "Ola"}}
        )
        await receive_non_room_list(first)
        await second.send_json_to(
            {"type": "join_game", "room": "oslo-1", "player": {"id": "p2", "name": "Kari"}}
        )
        await receive_non_room_list(first)
        await receive_non_room_list(second)

        await first.send_json_to(
            {"type": "choose_start_checkpoint", "checkpointTerritoryId": "lysaker_cp"}
        )
        first_snapshot = await receive_non_room_list(first)
        second_snapshot = await receive_non_room_list(second)

        await first.disconnect()
        await second.disconnect()
        return first_snapshot, second_snapshot

    first_snapshot, second_snapshot = async_to_sync(run)()
    assert first_snapshot == second_snapshot
    red = next(player for player in first_snapshot["state"]["players"] if player["side"] == "red")
    assert red["position"] == "lysaker_cp"
    assert red["setupConfirmed"] is False
    assert first_snapshot["state"]["phase"] == "setup"
    assert first_snapshot["state"]["activePlayer"] == "red"


def test_roll_dice_requires_start_checkpoint_selection():
    async def run():
        first = await connect_consumer()
        second = await connect_consumer()

        await first.send_json_to(
            {"type": "create_game", "room": "oslo-1", "player": {"id": "p1", "name": "Ola"}}
        )
        await receive_non_room_list(first)
        await second.send_json_to(
            {"type": "join_game", "room": "oslo-1", "player": {"id": "p2", "name": "Kari"}}
        )
        await receive_non_room_list(first)
        await receive_non_room_list(second)

        await first.send_json_to({"type": "roll_dice"})
        error = await receive_non_room_list(first)

        await first.disconnect()
        await second.disconnect()
        return error

    assert async_to_sync(run)() == {
        "type": "error",
        "message": "Velg startcheckpoint før første runde",
    }


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
                "ownerId": "p1",
                "playerIds": ["p1"],
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
    assert room["phase"] == "setup"
    assert room["status"] == "started"
    assert room["players"] == ["Ola", "Kari"]
    assert "territories" not in room
