"""
Unit tests for clock/state.py business logic.

Covers:
  - normalize_state
  - _level_total_seconds / compute_remaining_seconds
  - _prize_pool
  - stop_if_finished_and_advance
  - public_snapshot
  - update_players  (thread-safe global)
  - add_time_seconds (thread-safe global)
"""
import math
import time as _time

import pytest

from clock.state import (
    _create_state,
    _default_players,
    _default_tournament,
    _level_total_seconds,
    _prize_pool,
    add_time_seconds,
    compute_remaining_seconds,
    init_state,
    normalize_state,
    public_snapshot,
    stop_if_finished_and_advance,
    update_players,
    with_state,
)

# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_state(
    levels=None,
    current: int = 0,
    elapsed: float = 0,
    running: bool = False,
    started_ms=None,
    players: dict | None = None,
    buy_in: int = 200,
    rebuy_amount: int = 200,
    add_on_amount: int = 200,
):
    """Build a minimal state dict suitable for pure-function tests."""
    if levels is None:
        levels = [
            {"type": "level", "title": "L1", "seconds": 900, "sb": 50, "bb": 100, "ante": 0},
            {"type": "level", "title": "L2", "seconds": 900, "sb": 100, "bb": 200, "ante": 25},
            {"type": "break", "title": "Pause", "seconds": 300},
            {"type": "level", "title": "L3", "seconds": 600, "sb": 200, "bb": 400, "ante": 50},
        ]
    return {
        "tournament": {
            "name": "TestTurnering",
            "defaultLevelSeconds": 900,
            "buyIn": buy_in,
            "rebuyAmount": rebuy_amount,
            "addOnAmount": add_on_amount,
            "startingStack": 10_000,
            "levels": levels,
        },
        "players": players or _default_players(),
        "running": running,
        "currentIndex": current,
        "startedAtMs": started_ms,
        "elapsedInCurrentSeconds": elapsed,
    }


# ── normalize_state ─────────────────────────────────────────────────────────────

class TestNormalizeState:

    def test_non_dict_does_not_crash(self):
        """normalize_state ignores non-dict input (no exception)."""
        normalize_state(None)  # type: ignore
        normalize_state(42)    # type: ignore

    def test_resets_invalid_players_to_defaults(self):
        s = _make_state()
        s["players"] = "not-a-dict"
        normalize_state(s)
        assert isinstance(s["players"], dict)
        for k in ("registered", "busted", "rebuyCount", "addOnCount"):
            assert s["players"][k] == 0

    def test_fixes_negative_player_fields(self):
        s = _make_state(players={"registered": 5, "busted": -3, "rebuyCount": -1, "addOnCount": 2})
        normalize_state(s)
        assert s["players"]["busted"] == 0
        assert s["players"]["rebuyCount"] == 0
        assert s["players"]["registered"] == 5   # valid, untouched
        assert s["players"]["addOnCount"] == 2

    def test_clamps_current_index_above_max(self):
        s = _make_state(current=999)
        normalize_state(s)
        assert s["currentIndex"] == len(s["tournament"]["levels"]) - 1

    def test_clamps_current_index_below_zero(self):
        s = _make_state(current=-5)
        normalize_state(s)
        assert s["currentIndex"] == 0

    def test_coerces_string_current_index(self):
        s = _make_state()
        s["currentIndex"] = "2"
        normalize_state(s)
        assert s["currentIndex"] == 2

    def test_invalid_started_at_ms_reset_to_none(self):
        for bad in ("yesterday", None, math.nan, math.inf):
            s = _make_state()
            s["startedAtMs"] = bad
            normalize_state(s)
            assert s["startedAtMs"] is None

    def test_nan_elapsed_reset_to_zero(self):
        s = _make_state(elapsed=math.nan)
        normalize_state(s)
        assert s["elapsedInCurrentSeconds"] == 0

    def test_negative_elapsed_reset_to_zero(self):
        s = _make_state(elapsed=-10)
        normalize_state(s)
        assert s["elapsedInCurrentSeconds"] == 0

    def test_running_coerced_to_bool(self):
        s = _make_state()
        s["running"] = 1   # truthy int
        normalize_state(s)
        assert s["running"] is True

        s["running"] = 0
        normalize_state(s)
        assert s["running"] is False

    def test_converts_duration_seconds_in_levels(self):
        levels = [{"type": "level", "title": "L", "durationSeconds": 600, "sb": 50, "bb": 100, "ante": 0}]
        s = _make_state(levels=levels)
        normalize_state(s)
        assert s["tournament"]["levels"][0]["seconds"] == 600

    def test_converts_duration_minutes_in_levels(self):
        levels = [{"type": "level", "title": "L", "durationMinutes": 15, "sb": 50, "bb": 100, "ante": 0}]
        s = _make_state(levels=levels)
        normalize_state(s)
        assert s["tournament"]["levels"][0]["seconds"] == 15 * 60

    def test_duration_minutes_takes_precedence_over_duration_seconds(self):
        # durationMinutes wins when both are present
        levels = [{"type": "level", "title": "L", "durationMinutes": 10, "durationSeconds": 600, "sb": 50, "bb": 100, "ante": 0}]
        s = _make_state(levels=levels)
        normalize_state(s)
        assert s["tournament"]["levels"][0]["seconds"] == 10 * 60


# ── _level_total_seconds ────────────────────────────────────────────────────────

class TestLevelTotalSeconds:

    def test_returns_level_seconds(self):
        s = _make_state()
        assert _level_total_seconds(s) == 900

    def test_falls_back_to_default_level_seconds(self):
        # Level without "seconds" key
        levels = [{"type": "level", "title": "L"}]
        s = _make_state(levels=levels)
        assert _level_total_seconds(s) == 900  # defaultLevelSeconds

    def test_no_levels_returns_zero(self):
        s = _make_state(levels=[])
        assert _level_total_seconds(s) == 0

    def test_break_level_uses_its_own_seconds(self):
        s = _make_state(current=2)  # index 2 = break (300s)
        assert _level_total_seconds(s) == 300


# ── compute_remaining_seconds ───────────────────────────────────────────────────

class TestComputeRemainingSeconds:

    def test_paused_remaining(self):
        s = _make_state(elapsed=300, running=False)
        r = compute_remaining_seconds(s, now_ms=0)
        assert r["total"] == 900
        assert r["elapsed"] == 300
        assert r["remaining"] == 600

    def test_paused_elapsed_does_not_grow(self):
        """now_ms should not affect elapsed when not running."""
        s = _make_state(elapsed=300, running=False)
        r1 = compute_remaining_seconds(s, now_ms=0)
        r2 = compute_remaining_seconds(s, now_ms=60_000)
        assert r1["elapsed"] == r2["elapsed"]

    def test_running_adds_time_since_start(self):
        now_ms = 100_000
        started_ms = now_ms - 30_000  # started 30 seconds ago
        s = _make_state(elapsed=0, running=True, started_ms=started_ms)
        r = compute_remaining_seconds(s, now_ms=now_ms)
        assert r["elapsed"] == 30
        assert r["remaining"] == 870

    def test_running_base_elapsed_plus_live_time(self):
        """Pre-existing elapsed accumulates with new live time."""
        now_ms = 100_000
        started_ms = now_ms - 60_000  # 60 more seconds since un-pause
        s = _make_state(elapsed=120, running=True, started_ms=started_ms)
        r = compute_remaining_seconds(s, now_ms=now_ms)
        assert r["elapsed"] == 180
        assert r["remaining"] == 720

    def test_remaining_clamps_to_zero(self):
        """Elapsed > total must yield remaining=0, never negative."""
        s = _make_state(elapsed=1000, running=False)  # > 900s level
        r = compute_remaining_seconds(s, now_ms=0)
        assert r["remaining"] == 0

    def test_total_matches_level_seconds(self):
        s = _make_state()
        r = compute_remaining_seconds(s, now_ms=0)
        assert r["total"] == 900


# ── _prize_pool ──────────────────────────────────────────────────────────────────

class TestPrizePool:

    def test_basic_prize_pool(self):
        s = _make_state(players={"registered": 8, "busted": 0, "rebuyCount": 0, "addOnCount": 0}, buy_in=200)
        p = _prize_pool(s)
        assert p["prizePool"] == 1_600
        assert p["registered"] == 8
        assert p["active"] == 8

    def test_with_rebuys_and_add_ons(self):
        s = _make_state(
            players={"registered": 5, "busted": 1, "rebuyCount": 3, "addOnCount": 2},
            buy_in=200,
            rebuy_amount=200,
            add_on_amount=100,
        )
        p = _prize_pool(s)
        # 5*200 + 3*200 + 2*100 = 1000 + 600 + 200 = 1800
        assert p["prizePool"] == 1_800

    def test_active_is_registered_minus_busted(self):
        s = _make_state(players={"registered": 10, "busted": 3, "rebuyCount": 0, "addOnCount": 0})
        p = _prize_pool(s)
        assert p["active"] == 7

    def test_active_never_negative(self):
        """busted > registered should give active=0, not negative."""
        s = _make_state(players={"registered": 2, "busted": 5, "rebuyCount": 0, "addOnCount": 0})
        p = _prize_pool(s)
        assert p["active"] == 0

    def test_missing_tournament_money_settings_fallback_to_zero(self):
        s = _make_state(buy_in=0, rebuy_amount=0, add_on_amount=0,
                        players={"registered": 5, "busted": 0, "rebuyCount": 2, "addOnCount": 1})
        p = _prize_pool(s)
        assert p["prizePool"] == 0

    def test_returns_all_expected_keys(self):
        s = _make_state()
        p = _prize_pool(s)
        for key in ("registered", "busted", "active", "rebuyCount", "addOnCount", "prizePool"):
            assert key in p


# ── stop_if_finished_and_advance ────────────────────────────────────────────────

class TestStopIfFinishedAndAdvance:

    def test_no_change_when_time_remaining(self):
        s = _make_state(elapsed=300)
        changed, event = stop_if_finished_and_advance(s, now_ms=0)
        assert changed is False
        assert event is None
        assert s["currentIndex"] == 0

    def test_advances_to_next_level_when_exhausted(self):
        s = _make_state(elapsed=900)  # exactly at end of L1 (900s)
        changed, event = stop_if_finished_and_advance(s, now_ms=0)
        assert changed is True
        assert event == "LEVEL_ADVANCED"
        assert s["currentIndex"] == 1

    def test_resets_elapsed_on_advance(self):
        s = _make_state(elapsed=950)
        stop_if_finished_and_advance(s, now_ms=0)
        assert s["elapsedInCurrentSeconds"] == 0

    def test_keeps_running_state_on_advance(self):
        s = _make_state(elapsed=1000, running=True, started_ms=0)
        stop_if_finished_and_advance(s, now_ms=0)
        assert s["running"] is True

    def test_sets_started_at_ms_to_now_if_running(self):
        now_ms = 99_000
        s = _make_state(elapsed=1000, running=True, started_ms=0)
        stop_if_finished_and_advance(s, now_ms=now_ms)
        assert s["startedAtMs"] == now_ms

    def test_started_at_ms_none_if_paused_on_advance(self):
        s = _make_state(elapsed=1000, running=False)
        stop_if_finished_and_advance(s, now_ms=50_000)
        assert s["startedAtMs"] is None

    def test_tournament_ended_on_last_level(self):
        # Put state at the last level (index 3) with elapsed >= total
        s = _make_state(current=3, elapsed=600)   # L3 = 600s
        changed, event = stop_if_finished_and_advance(s, now_ms=0)
        assert changed is True
        assert event == "TOURNAMENT_ENDED"
        assert s["running"] is False
        assert s["startedAtMs"] is None

    def test_no_levels_returns_no_change(self):
        s = _make_state(levels=[])
        changed, event = stop_if_finished_and_advance(s, now_ms=0)
        assert changed is False
        assert event is None


# ── public_snapshot ─────────────────────────────────────────────────────────────

class TestPublicSnapshot:

    def test_required_keys_present(self):
        s = _make_state()
        snap = public_snapshot(s, now_ms=0)
        for key in ("tournament", "running", "currentIndex", "timing", "serverNowMs", "players"):
            assert key in snap, f"Missing key: {key}"

    def test_timing_matches_compute_remaining(self):
        s = _make_state(elapsed=400)
        now = 0
        snap = public_snapshot(s, now_ms=now)
        expected = compute_remaining_seconds(s, now_ms=now)
        assert snap["timing"] == expected

    def test_players_section_matches_prize_pool(self):
        s = _make_state(players={"registered": 6, "busted": 1, "rebuyCount": 2, "addOnCount": 1})
        snap = public_snapshot(s, now_ms=0)
        expected = _prize_pool(s)
        assert snap["players"] == expected

    def test_server_now_ms_reflects_argument(self):
        s = _make_state()
        snap = public_snapshot(s, now_ms=12_345_678)
        assert snap["serverNowMs"] == 12_345_678


# ── update_players (thread-safe global) ─────────────────────────────────────────

class TestUpdatePlayers:

    def setup_method(self):
        """Fresh global state before every test."""
        base = _create_state()
        base["players"] = {"registered": 5, "busted": 1, "rebuyCount": 2, "addOnCount": 0}
        init_state(base)

    def test_sets_registered(self):
        update_players({"registered": 10})
        result = with_state(lambda s: s["players"]["registered"])
        assert result == 10

    def test_increments_do_not_apply_via_update(self):
        """update_players does a full set, not increment."""
        update_players({"busted": 3})
        result = with_state(lambda s: s["players"]["busted"])
        assert result == 3

    def test_clamps_negative_to_zero(self):
        update_players({"rebuyCount": -10})
        result = with_state(lambda s: s["players"]["rebuyCount"])
        assert result == 0

    def test_ignores_unknown_keys(self):
        update_players({"nonExistentKey": 99})
        result = with_state(lambda s: s["players"])
        assert "nonExistentKey" not in result
        # existing values untouched
        assert result["registered"] == 5

    def test_partial_update_leaves_other_fields_intact(self):
        update_players({"addOnCount": 3})
        result = with_state(lambda s: s["players"])
        assert result["registered"] == 5  # untouched
        assert result["busted"] == 1       # untouched
        assert result["addOnCount"] == 3   # updated

    def test_update_multiple_fields(self):
        update_players({"registered": 8, "rebuyCount": 4})
        result = with_state(lambda s: s["players"])
        assert result["registered"] == 8
        assert result["rebuyCount"] == 4


# ── add_time_seconds (thread-safe global) ───────────────────────────────────────

class TestAddTimeSeconds:

    def setup_method(self):
        """Fresh paused global state at elapsed=300 (5 min elapsed of a 15-min level)."""
        base = _create_state()
        base["elapsedInCurrentSeconds"] = 300
        base["running"] = False
        base["startedAtMs"] = None
        init_state(base)

    def test_paused_increases_remaining(self):
        """add 60s of remaining → elapsed decreases by 60."""
        add_time_seconds(60, now_ms=0)
        elapsed = with_state(lambda s: s["elapsedInCurrentSeconds"])
        assert elapsed == 240

    def test_paused_clamps_elapsed_to_zero(self):
        """Cannot give back more time than has elapsed."""
        add_time_seconds(500, now_ms=0)  # more than 300 elapsed
        elapsed = with_state(lambda s: s["elapsedInCurrentSeconds"])
        assert elapsed == 0

    def test_paused_negative_seconds_reduces_remaining(self):
        """add_time_seconds(-60) takes 1 minute away (adds to elapsed)."""
        add_time_seconds(-60, now_ms=0)
        elapsed = with_state(lambda s: s["elapsedInCurrentSeconds"])
        assert elapsed == 360

    def test_add_zero_seconds_is_noop(self):
        add_time_seconds(0, now_ms=0)
        elapsed = with_state(lambda s: s["elapsedInCurrentSeconds"])
        assert elapsed == 300

    def test_running_snaps_elapsed_and_adjusts(self):
        """
        Running clock: base elapsed=0, started 100s ago.
        add 60s → remaining should grow by 60 → new elapsed = 100 - 60 = 40.
        startedAtMs should be snapped to now_ms.

        Note: init_state() resets startedAtMs to the real current time when
        running=True, so we override it with with_state() afterwards.
        """
        base = _create_state()
        base["elapsedInCurrentSeconds"] = 0
        base["running"] = True
        init_state(base)

        # init_state replaced startedAtMs; pin it to a deterministic offset
        now_ms = _time.time() * 1000
        started_ms = now_ms - 100_000  # 100 s ago
        with_state(lambda s: s.update({"startedAtMs": started_ms}))

        add_time_seconds(60, now_ms=now_ms)

        state = with_state(lambda s: dict(s))
        assert state["elapsedInCurrentSeconds"] == 40
        assert state["startedAtMs"] == now_ms

    def test_running_clamps_to_zero_even_with_large_add(self):
        """Adding more seconds than have elapsed clamps elapsed to 0."""
        base = _create_state()
        base["elapsedInCurrentSeconds"] = 0
        base["running"] = True
        init_state(base)

        # Pin startedAtMs to 30s ago so only 30s of live time have elapsed
        now_ms = _time.time() * 1000
        started_ms = now_ms - 30_000
        with_state(lambda s: s.update({"startedAtMs": started_ms}))

        add_time_seconds(200, now_ms=now_ms)  # ask for 200s back, only 30 elapsed

        elapsed = with_state(lambda s: s["elapsedInCurrentSeconds"])
        assert elapsed == 0
