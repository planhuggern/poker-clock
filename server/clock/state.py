"""
Clock state management — multi-tournament edition.

Each tournament has its own state dict protected by its own RLock.
A meta-lock guards the registry dicts themselves.

All public functions accept `tournament_id: int = 1` for backward compat.
"""
import copy
import math
import threading
import time
from typing import Any

# Registry: tournament_id → {state_dict, lock}
_meta_lock: threading.Lock = threading.Lock()
_states: dict[int, dict]          = {}   # tournament_id → state dict
_locks:  dict[int, threading.RLock] = {}  # tournament_id → RLock


# ── Defaults ──────────────────────────────────────────────────────────────────

def _default_tournament() -> dict:
    m = 15 * 60
    return {
        "name": "Pokerturnering",
        "defaultLevelSeconds": m,
        "buyIn": 200,
        "rebuyAmount": 200,
        "addOnAmount": 200,
        "startingStack": 10000,
        "levels": [
            {"type": "level", "title": "Level 1",  "sb": 25,  "bb": 50,  "ante": 0,   "seconds": m},
            {"type": "level", "title": "Level 2",  "sb": 50,  "bb": 100, "ante": 0,   "seconds": m},
            {"type": "level", "title": "Level 3",  "sb": 75,  "bb": 150, "ante": 0,   "seconds": m},
            {"type": "break", "title": "Pause",                                         "seconds": 10 * 60},
            {"type": "level", "title": "Level 4",  "sb": 100, "bb": 200, "ante": 25,  "seconds": m},
            {"type": "level", "title": "Level 5",  "sb": 150, "bb": 300, "ante": 25,  "seconds": m},
            {"type": "level", "title": "Level 6",  "sb": 200, "bb": 400, "ante": 50,  "seconds": m},
            {"type": "break", "title": "Pause",                                         "seconds": 10 * 60},
            {"type": "level", "title": "Level 7",  "sb": 300, "bb": 600, "ante": 75,  "seconds": m},
            {"type": "level", "title": "Level 8",  "sb": 400, "bb": 800, "ante": 100, "seconds": m},
            {"type": "level", "title": "Level 9",  "sb": 500, "bb": 1000,"ante": 100, "seconds": m},
            {"type": "break", "title": "Pause",                                         "seconds": 10 * 60},
            {"type": "level", "title": "Level 10", "sb": 600, "bb": 1200,"ante": 200, "seconds": m},
            {"type": "level", "title": "Level 11", "sb": 800, "bb": 1600,"ante": 200, "seconds": m},
            {"type": "level", "title": "Level 12", "sb": 1000,"bb": 2000,"ante": 300, "seconds": m},
        ],
    }


def _default_players() -> dict:
    return {
        "registered": 0,
        "busted": 0,
        "rebuyCount": 0,
        "addOnCount": 0,
    }


def _create_state() -> dict:
    return {
        "tournament": _default_tournament(),
        "players": _default_players(),
        "running": False,
        "currentIndex": 0,
        "startedAtMs": None,
        "elapsedInCurrentSeconds": 0,
    }


# ── Normalisation ─────────────────────────────────────────────────────────────

def _coerce_int(value, fallback: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def normalize_state(s: dict) -> None:
    """Mutates s in-place, fixing any invalid/missing fields."""
    if not isinstance(s, dict):
        return

    if not isinstance(s.get("players"), dict):
        s["players"] = _default_players()
    else:
        p = s["players"]
        for key in ("registered", "busted", "rebuyCount", "addOnCount"):
            if not isinstance(p.get(key), int) or p[key] < 0:
                p[key] = 0

    if not isinstance(s.get("currentIndex"), int):
        s["currentIndex"] = _coerce_int(s.get("currentIndex"), 0)

    levels = s.get("tournament", {}).get("levels") or []
    max_idx = max(0, len(levels) - 1)
    s["currentIndex"] = max(0, min(s["currentIndex"], max_idx))

    v = s.get("startedAtMs")
    if not (isinstance(v, (int, float)) and math.isfinite(v)):
        s["startedAtMs"] = None

    e = s.get("elapsedInCurrentSeconds")
    if not (isinstance(e, (int, float)) and math.isfinite(e) and e >= 0):
        s["elapsedInCurrentSeconds"] = 0

    s["running"] = bool(s.get("running"))

    t = s.get("tournament") or {}
    dls = t.get("defaultLevelSeconds")
    if not (isinstance(dls, (int, float)) and math.isfinite(dls) and dls >= 0):
        t["defaultLevelSeconds"] = 15 * 60

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


# ── Pure computation helpers ──────────────────────────────────────────────────

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


def _prize_pool(s: dict) -> dict:
    t = s.get("tournament") or {}
    p = s.get("players") or {}
    registered    = max(0, int(p.get("registered")  or 0))
    busted        = max(0, int(p.get("busted")       or 0))
    rebuy_count   = max(0, int(p.get("rebuyCount")   or 0))
    add_on_count  = max(0, int(p.get("addOnCount")   or 0))
    buy_in        = max(0, int(t.get("buyIn")        or 0))
    rebuy_amount  = max(0, int(t.get("rebuyAmount")  or 0))
    add_on_amount = max(0, int(t.get("addOnAmount")  or 0))
    total = registered * buy_in + rebuy_count * rebuy_amount + add_on_count * add_on_amount
    return {
        "registered": registered,
        "busted": busted,
        "active": max(0, registered - busted),
        "rebuyCount": rebuy_count,
        "addOnCount": add_on_count,
        "prizePool": total,
    }


def public_snapshot(s: dict, now_ms: float | None = None) -> dict:
    if now_ms is None:
        now_ms = time.time() * 1000
    return {
        "tournament": s["tournament"],
        "running": s["running"],
        "currentIndex": s["currentIndex"],
        "timing": compute_remaining_seconds(s, now_ms),
        "serverNowMs": now_ms,
        "players": _prize_pool(s),
    }


def stop_if_finished_and_advance(s: dict, now_ms: float) -> tuple[bool, str | None]:
    """Returns (changed, event_name). Mutates s in place."""
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


# ── Registry helpers ──────────────────────────────────────────────────────────

def _get_lock(tournament_id: int) -> threading.RLock:
    """Return the RLock for *tournament_id*, creating it if needed."""
    with _meta_lock:
        if tournament_id not in _locks:
            _locks[tournament_id] = threading.RLock()
        return _locks[tournament_id]


# ── Public API ────────────────────────────────────────────────────────────────

def init_state(loaded: dict | None = None, tournament_id: int = 1) -> None:
    """Initialise (or reset) the in-memory state for *tournament_id*."""
    lock = _get_lock(tournament_id)
    with lock:
        s = loaded if loaded else _create_state()
        normalize_state(s)
        if s["running"]:
            s["startedAtMs"] = time.time() * 1000
        with _meta_lock:
            _states[tournament_id] = s


def list_tournament_ids() -> list[int]:
    """Return the list of tournament IDs currently held in memory."""
    with _meta_lock:
        return list(_states.keys())


def get_snapshot(now_ms: float | None = None, tournament_id: int = 1) -> dict:
    lock = _get_lock(tournament_id)
    with lock:
        s = _states.get(tournament_id)
        if s is None:
            raise KeyError(f"Tournament {tournament_id} not in memory")
        return public_snapshot(s, now_ms)


def get_state_copy(tournament_id: int = 1) -> dict:
    lock = _get_lock(tournament_id)
    with lock:
        s = _states.get(tournament_id)
        if s is None:
            raise KeyError(f"Tournament {tournament_id} not in memory")
        return copy.deepcopy(s)


def with_state(fn, tournament_id: int = 1) -> Any:
    """Call fn(state) inside the tournament's lock; returns its return value."""
    lock = _get_lock(tournament_id)
    with lock:
        s = _states.get(tournament_id)
        if s is None:
            raise KeyError(f"Tournament {tournament_id} not in memory")
        return fn(s)


def update_players(patch: dict, tournament_id: int = 1) -> None:
    """Merge patch into state['players'] (integers clamped to >= 0)."""
    lock = _get_lock(tournament_id)
    with lock:
        s = _states.get(tournament_id)
        if s is None:
            raise KeyError(f"Tournament {tournament_id} not in memory")
        p = s.setdefault("players", _default_players())
        for k, v in patch.items():
            if k in ("registered", "busted", "rebuyCount", "addOnCount"):
                try:
                    p[k] = max(0, int(v))
                except (TypeError, ValueError):
                    pass


def add_time_seconds(seconds: int, now_ms: float, tournament_id: int = 1) -> None:
    """Reduce elapsedInCurrentSeconds so remaining increases by *seconds*."""
    lock = _get_lock(tournament_id)
    with lock:
        s = _states.get(tournament_id)
        if s is None:
            raise KeyError(f"Tournament {tournament_id} not in memory")
        elapsed = s.get("elapsedInCurrentSeconds") or 0
        if s.get("running") and isinstance(s.get("startedAtMs"), (int, float)):
            elapsed += (now_ms - s["startedAtMs"]) / 1000
        if s.get("running"):
            s["elapsedInCurrentSeconds"] = max(0, elapsed - seconds)
            s["startedAtMs"] = now_ms
        else:
            s["elapsedInCurrentSeconds"] = max(0, (s.get("elapsedInCurrentSeconds") or 0) - seconds)
