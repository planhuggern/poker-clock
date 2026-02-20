"""
Background tick thread: advances the clock every second and broadcasts to all
connected WebSocket clients via the channel layer.

Uses asgiref.sync.async_to_sync so it can call async channel-layer methods from
a plain threading.Thread.
"""
import time
import threading

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from . import state as gs

_GROUP = "clock"
_started = False
_lock = threading.Lock()


def _tick_loop() -> None:
    channel_layer = get_channel_layer()

    while True:
        time.sleep(1)
        now_ms = time.time() * 1000

        def _run(s: dict):
            changed, event = gs.stop_if_finished_and_advance(s, now_ms)
            snap = gs.public_snapshot(s, now_ms)
            return changed, event, snap

        changed, event, snap = gs.with_state(_run)

        if changed:
            _save_async()
            _broadcast(channel_layer, {"type": "snapshot", **snap})
            if event:
                _broadcast(channel_layer, {"type": "system_event", "event": event})
            _broadcast(channel_layer, {"type": "play_sound", "soundType": "level_advance"})
        else:
            _broadcast(channel_layer, {"type": "tick", **snap})
            # 60-second warning
            remaining = snap["timing"]["remaining"]
            if isinstance(remaining, (int, float)) and int(remaining) == 60:
                _broadcast(channel_layer, {"type": "play_sound", "soundType": "one_minute_left"})


def _broadcast(channel_layer, message: dict) -> None:
    try:
        async_to_sync(channel_layer.group_send)(
            _GROUP,
            {"type": "clock.broadcast", "message": message},
        )
    except Exception as exc:
        print(f"[tick] broadcast error: {exc}")


def _save_async() -> None:
    """Persist state in a quick fire-and-forget fashion."""
    def _do():
        from .models import AppState
        data = gs.get_state_copy()
        try:
            AppState.persist(data)
        except Exception as exc:
            print(f"[tick] save error: {exc}")

    threading.Thread(target=_do, daemon=True).start()


def start_tick_thread() -> None:
    global _started
    with _lock:
        if _started:
            return
        _started = True
    t = threading.Thread(target=_tick_loop, daemon=True, name="clock-tick")
    t.start()
