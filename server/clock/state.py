"""
Clock state management.  Direct port of server/state.js.

All state lives in a single dict (_state) protected by a threading.RLock.
Call init_state() once at startup (inside AppConfig.ready()).
"""
import copy
import math
import threading
import time
from typing import Any

_lock = threading.RLock()
_state: dict = {}


# ── Defaults ──────────────────────────────────────────────────────────────────

def _default_tournament() -> dict:
    m = 15 * 60
    return {
        "name": "Pokerturnering",
        "defaultLevelSeconds": m,
        "levels": [
            {"type": "level", "title": "Level 1", "sb": 50,  "bb": 100, "ante": 0,  "seconds": m},
            {"type": "level", "title": "Level 2", "sb": 75,  "bb": 150, "ante": 0,  "seconds": m},
            {"type": "break", "title": "Pause",                                       "seconds": 5 * 60},
            {"type": "level", "title": "Level 3", "sb": 100, "bb": 200, "ante": 25, "seconds": m},
        ],
    }


def _create_state() -> dict:
    return {
        "tournament": _default_tournament(),
        "running": False,
        "currentIndex": 0,
        "startedAtMs": None,
        "elapsedInCurrentSeconds": 0,
    }


# ── Normalisation ─────────────────────────────────────────────────────────────

def _coerce_int(value, fallback: int = 0) -> int:
    try:
        v = int(value)
        return v
    except (TypeError, ValueError):
        return fallback


def normalize_state(s: dict) -> None:
    """Mutates s in-place, fixing any invalid/missing fields."""
    if not isinstance(s, dict):
        return

    # currentIndex
    if not isinstance(s.get("currentIndex"), int):
        s["currentIndex"] = _coerce_int(s.get("currentIndex"), 0)

    levels = s.get("tournament", {}).get("levels") or []
    max_idx = max(0, len(levels) - 1)
    s["currentIndex"] = max(0, min(s["currentIndex"], max_idx))

    # startedAtMs
    v = s.get("startedAtMs")
    if not (isinstance(v, (int, float)) and math.isfinite(v)):
        s["startedAtMs"] = None

    # elapsedInCurrentSeconds
    e = s.get("elapsedInCurrentSeconds")
    if not (isinstance(e, (int, float)) and math.isfinite(e) and e >= 0):
        s["elapsedInCurrentSeconds"] = 0

    # running
    s["running"] = bool(s.get("running"))

    # tournament.defaultLevelSeconds
    t = s.get("tournament") or {}
    dls = t.get("defaultLevelSeconds")
    if not (isinstance(dls, (int, float)) and math.isfinite(dls) and dls >= 0):
        t["defaultLevelSeconds"] = 15 * 60

    # Normalise level seconds
    if isinstance(t.get("levels"), list):
        for lvl in t["levels"]:
            if not isinstance(lvl, dict):
                continue
            minutes = lvl.get("durationMinutes") if isinstance(lvl.get("durationMinutes"), (int, float)) else lvl.get("minutes")
            if isinstance(minutes, (int, float)) and math.isfinite(minutes) and minutes >= 0:
                lvl["seconds"] = minutes * 60
            elif isinstance(lvl.get("durationSeconds"), (int, float)) and math.isfinite(lvl["durationSeconds"]) and lvl["durationSeconds"] >= 0:
                lvl["seconds"] = lvl["durationSeconds"]
            if not (isinstance(lvl.get("seconds"), (int, float)) and math.isfinite(lvl["seconds"]) and lvl["seconds"] >= 0):
                lvl.pop("seconds", None)


# ── Level helpers ─────────────────────────────────────────────────────────────

def _current_level(s: dict) -> dict | None:
    levels = s.get("tournament", {}).get("levels") or []
    i = s.get("currentIndex", 0)
    return levels[i] if 0 <= i < len(levels) else None


def _level_total_seconds(s: dict) -> float:
    lvl = _current_level(s)
    if not lvl:
        return 0
    sec = lvl.get("seconds")
    if isinstance(sec, (int, float)) and math.isfinite(sec) and sec >= 0:
        return sec
    fb = s.get("tournament", {}).get("defaultLevelSeconds", 0)
    return fb if isinstance(fb, (int, float)) and math.isfinite(fb) and fb >= 0 else 0


# ── Public API ────────────────────────────────────────────────────────────────

def compute_remaining_seconds(s: dict, now_ms: float | None = None) -> dict:
    if now_ms is None:
        now_ms = time.time() * 1000
    total = _level_total_seconds(s)
    elapsed: float = s.get("elapsedInCurrentSeconds") or 0
    if not (isinstance(elapsed, (int, float)) and math.isfinite(elapsed) and elapsed >= 0):
        elapsed = 0

    started = s.get("startedAtMs")
    if s.get("running") and isinstance(started, (int, float)) and math.isfinite(started):
        elapsed += math.floor((now_ms - started) / 1000)

    remaining = max(0, total - elapsed)
    return {"total": total, "elapsed": elapsed, "remaining": remaining}


def public_snapshot(s: dict, now_ms: float | None = None) -> dict:
    if now_ms is None:
        now_ms = time.time() * 1000
    return {
        "tournament": s["tournament"],
        "running": s["running"],
        "currentIndex": s["currentIndex"],
        "timing": compute_remaining_seconds(s, now_ms),
        "serverNowMs": now_ms,
    }


def stop_if_finished_and_advance(s: dict, now_ms: float) -> tuple[bool, str | None]:
    """Returns (changed, event_name)."""
    lvl = _current_level(s)
    if not lvl:
        return False, None
    timing = compute_remaining_seconds(s, now_ms)
    if timing["remaining"] > 0:
        return False, None

    levels = s["tournament"]["levels"]
    if s["currentIndex"] < len(levels) - 1:
        s["currentIndex"] += 1
        s["elapsedInCurrentSeconds"] = 0
        s["startedAtMs"] = now_ms if s["running"] else None
        return True, "LEVEL_ADVANCED"
    else:
        s["running"] = False
        s["startedAtMs"] = None
        s["elapsedInCurrentSeconds"] = _level_total_seconds(s)
        return True, "TOURNAMENT_ENDED"


# ── Thread-safe state accessors ───────────────────────────────────────────────

def init_state(loaded: dict | None = None) -> None:
    global _state
    with _lock:
        _state = loaded if loaded else _create_state()
        normalize_state(_state)
        if _state["running"]:
            _state["startedAtMs"] = time.time() * 1000


def get_snapshot(now_ms: float | None = None) -> dict:
    with _lock:
        return public_snapshot(_state, now_ms)


def get_state_copy() -> dict:
    with _lock:
        return copy.deepcopy(_state)


def with_state(fn) -> Any:
    """Call fn(state) inside the lock; returns its return value."""
    with _lock:
        return fn(_state)
