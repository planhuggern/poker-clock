"""Tests for the forfeit() function in oslo_conquest.mvp."""
import pytest

from oslo_conquest.mvp import PLAYER_COLORS, forfeit


def _make_playing_room():
    from oslo_conquest.board import TERRITORY_IDS

    territories = {tid: {"id": tid, "owner": None, "units": 1} for tid in TERRITORY_IDS}
    return {
        "room": "test",
        "phase": "playing",
        "started": True,
        "activePlayer": "red",
        "winner": None,
        "log": [],
        "players": [
            {
                "id": "p_red",
                "name": "Røde",
                "side": "red",
                "color": PLAYER_COLORS["red"],
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
                "id": "p_blue",
                "name": "Blå",
                "side": "blue",
                "color": PLAYER_COLORS["blue"],
                "position": "kolbotn_cp",
                "diceRoll": None,
                "movesRemaining": 0,
                "validMoves": [],
                "setupConfirmed": True,
                "money": 2000,
                "units": 10,
                "nextCheckpoint": "lørenskog_cp",
            },
        ],
        "territories": territories,
    }


def test_red_forfeits_gives_blue_win():
    room = _make_playing_room()
    room, error = forfeit(room, "p_red")
    assert error is None
    assert room["winner"] == "blue"
    assert room["phase"] == "finished"


def test_blue_forfeits_gives_red_win():
    room = _make_playing_room()
    room, error = forfeit(room, "p_blue")
    assert error is None
    assert room["winner"] == "red"
    assert room["phase"] == "finished"


def test_forfeit_logs_player_name():
    room = _make_playing_room()
    room, _ = forfeit(room, "p_red")
    assert any("Røde ga opp" in entry["msg"] for entry in room["log"])


def test_forfeit_unknown_player_returns_error():
    room = _make_playing_room()
    room, error = forfeit(room, "ukjent")
    assert error is not None
    assert room["phase"] == "playing"
    assert "winner" not in room or room["winner"] is None


def test_forfeit_game_not_started_returns_error():
    room = _make_playing_room()
    room["started"] = False
    room, error = forfeit(room, "p_red")
    assert error is not None


def test_forfeit_already_finished_returns_error():
    room = _make_playing_room()
    room["phase"] = "finished"
    room, error = forfeit(room, "p_red")
    assert error is not None


def test_non_active_player_can_forfeit():
    room = _make_playing_room()
    room["activePlayer"] = "red"
    room, error = forfeit(room, "p_blue")
    assert error is None
    assert room["winner"] == "red"


def test_forfeit_during_setup_phase():
    room = _make_playing_room()
    room["phase"] = "setup"
    room, error = forfeit(room, "p_red")
    assert error is None
    assert room["winner"] == "blue"
    assert room["phase"] == "finished"
