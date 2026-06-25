"""Tests for oslo_conquest.bot — get_bot_action() returns actions without mutating state."""
import pytest

from oslo_conquest.bot import BOT_PLAYER_ID, get_bot_action
from oslo_conquest.mvp import PLAYER_COLORS


def _make_room(phase: str, active_side: str, bot_position=None, bot_setup_confirmed=False):
    return {
        "room": "test",
        "phase": phase,
        "started": True,
        "activePlayer": active_side,
        "winner": None,
        "log": [],
        "players": [
            {
                "id": "p_human",
                "name": "Human",
                "side": "red",
                "color": PLAYER_COLORS["red"],
                "isBot": False,
                "position": "lysaker_cp",
                "diceRoll": None,
                "movesRemaining": 0,
                "validMoves": [],
                "setupConfirmed": True,
                "money": 2000,
                "units": 10,
                "nextCheckpoint": "kolbotn_cp",
            },
            {
                "id": BOT_PLAYER_ID,
                "name": "Bot",
                "side": "blue",
                "color": PLAYER_COLORS["blue"],
                "isBot": True,
                "position": bot_position,
                "diceRoll": None,
                "movesRemaining": 0,
                "validMoves": [],
                "setupConfirmed": bot_setup_confirmed,
                "money": 2000,
                "units": 10,
                "nextCheckpoint": "kolbotn_cp",
            },
        ],
        "territories": {},
    }


def test_returns_none_when_not_bots_turn():
    room = _make_room("playing", active_side="red")
    action = get_bot_action(room, BOT_PLAYER_ID)
    assert action is None


def test_returns_none_for_unknown_player():
    room = _make_room("playing", active_side="blue")
    action = get_bot_action(room, "no-such-id")
    assert action is None


def test_setup_without_position_returns_choose_start_checkpoint():
    room = _make_room("setup", active_side="blue", bot_position=None)
    action = get_bot_action(room, BOT_PLAYER_ID)
    assert action is not None
    assert action["type"] == "choose_start_checkpoint"
    assert "checkpointId" in action
    from oslo_conquest.board import CHECKPOINT_IDS
    assert action["checkpointId"] in CHECKPOINT_IDS


def test_setup_with_position_returns_end_turn():
    room = _make_room("setup", active_side="blue", bot_position="lørenskog_cp", bot_setup_confirmed=False)
    action = get_bot_action(room, BOT_PLAYER_ID)
    assert action is not None
    assert action["type"] == "end_turn"


def test_playing_phase_returns_end_turn():
    room = _make_room("playing", active_side="blue")
    action = get_bot_action(room, BOT_PLAYER_ID)
    assert action is not None
    assert action["type"] == "end_turn"


def test_finished_phase_returns_none():
    room = _make_room("finished", active_side="blue")
    action = get_bot_action(room, BOT_PLAYER_ID)
    assert action is None


def test_does_not_mutate_room_state():
    room = _make_room("playing", active_side="blue")
    original_active = room["activePlayer"]
    original_phase = room["phase"]
    get_bot_action(room, BOT_PLAYER_ID)
    assert room["activePlayer"] == original_active
    assert room["phase"] == original_phase
