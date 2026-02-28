"""
Per-tournament background tick threads.

Each active (non-finished) tournament has its own daemon thread that fires once
per second, advances the clock level if time runs out, broadcasts via the channel
layer, and persists state to the Tournament row.
"""
import threading
import time

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from . import state as gs

_tickers: dict[int, threading.Thread] = {}
_tickers_lock = threading.Lock()


def _group(tournament_id: int) -> str:
    return f"clock-{tournament_id}"


def _broadcast(channel_layer, tournament_id: int, message: dict) -> None:
    try:
        async_to_sync(channel_layer.group_send)(
            _group(tournament_id),
            {"type": "clock.broadcast", "message": message},
        )
    except Exception as exc:
        print(f"[tick-{tournament_id}] broadcast error: {exc}")


def _save_state(tournament_id: int, finished: bool = False) -> None:
    """Persist the in-memory state to Tournament.state_json (+ status if finished)."""
    def _do():
        from .models import Tournament
        try:
            data = gs.get_state_copy(tournament_id)
            updates: dict = {"state_json": data}
            if finished:
                updates["status"] = Tournament.STATUS_FINISHED
            elif data.get("running"):
                updates["status"] = Tournament.STATUS_RUNNING
            Tournament.objects.filter(pk=tournament_id).update(**updates)
        except Exception as exc:
            print(f"[tick-{tournament_id}] save error: {exc}")

    threading.Thread(target=_do, daemon=True).start()


def _tick_loop(tournament_id: int) -> None:
    channel_layer = get_channel_layer()

    while True:
        time.sleep(1)
        now_ms = time.time() * 1000

        try:
            def _run(s: dict):
                changed, event = gs.stop_if_finished_and_advance(s, now_ms)
                snap = gs.public_snapshot(s, now_ms)
                return changed, event, snap

            changed, event, snap = gs.with_state(_run, tournament_id=tournament_id)
        except KeyError:
            print(f"[tick-{tournament_id}] tournament removed from memory, stopping thread")
            break

        if changed:
            finished = event == "TOURNAMENT_ENDED"
            _save_state(tournament_id, finished=finished)
            _broadcast(channel_layer, tournament_id, {"type": "snapshot", **snap})
            if event:
                _broadcast(channel_layer, tournament_id, {"type": "system_event", "event": event})
                _broadcast(channel_layer, tournament_id, {"type": "play_sound",  "soundType": "level_advance"})
            if finished:
                with _tickers_lock:
                    _tickers.pop(tournament_id, None)
                break
        else:
            _broadcast(channel_layer, tournament_id, {"type": "tick", **snap})
            remaining = snap["timing"]["remaining"]
            if isinstance(remaining, (int, float)) and int(remaining) == 60:
                _broadcast(channel_layer, tournament_id, {"type": "play_sound", "soundType": "one_minute_left"})


def start_tick_thread(tournament_id: int = 1) -> None:
    """Start a tick thread for *tournament_id* if one is not already running."""
    with _tickers_lock:
        if tournament_id in _tickers:
            return
        t = threading.Thread(
            target=_tick_loop,
            args=(tournament_id,),
            daemon=True,
            name=f"clock-tick-{tournament_id}",
        )
        _tickers[tournament_id] = t
        t.start()
