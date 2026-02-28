"""
WebSocket consumer for the poker clock  per-tournament edition.

Token passed as query-string: ws://host/ws/clock/<tournament_id>/?token=<jwt>

Message protocol (JSON):
  Client  Server:  { "type": "get_snapshot" | "admin_start" | ... }
  Server  Client:  { "type": "snapshot" | "tick" | "play_sound" | "system_event" | "error_msg", ... }
"""
import json
import math
import time
import threading
from urllib.parse import parse_qs

from channels.generic.websocket import AsyncWebsocketConsumer

from . import state as gs

#  Debounced save helpers 

_save_timers: dict[int, threading.Timer] = {}
_save_lock = threading.Lock()


def _schedule_save(tournament_id: int, ms: int = 250) -> None:
    def _do():
        from .models import Tournament
        try:
            data = gs.get_state_copy(tournament_id)
            status = Tournament.STATUS_RUNNING if data.get("running") else Tournament.STATUS_PENDING
            Tournament.objects.filter(pk=tournament_id).update(state_json=data, status=status)
        except Exception as exc:
            print(f"[consumer] save error for tournament {tournament_id}: {exc}")

    with _save_lock:
        existing = _save_timers.get(tournament_id)
        if existing:
            existing.cancel()
        t = threading.Timer(ms / 1000, _do)
        t.daemon = True
        _save_timers[tournament_id] = t
        t.start()


def _verify_token(token: str) -> dict | None:
    import jwt as pyjwt
    from django.conf import settings
    secret = settings.CONFIG.get("jwtSecret", "")
    try:
        return pyjwt.decode(token, secret, algorithms=["HS256"])
    except Exception:
        return None


class ClockConsumer(AsyncWebsocketConsumer):

    #  Lifecycle 

    async def connect(self) -> None:
        # Tournament id from URL or default to 1
        kwargs = self.scope.get("url_route", {}).get("kwargs", {})
        try:
            self.tournament_id: int = int(kwargs.get("tournament_id", 1))
        except (TypeError, ValueError):
            self.tournament_id = 1
        self._group = f"clock-{self.tournament_id}"

        qs = parse_qs(self.scope.get("query_string", b"").decode())
        token = (qs.get("token") or [None])[0]
        if not token:
            await self.close(code=4001)
            return

        payload = _verify_token(token)
        if not payload:
            await self.close(code=4001)
            return

        self.user = payload  # {"username": ..., "role": ...}

        # Make sure the tournament state is loaded
        try:
            gs.get_snapshot(tournament_id=self.tournament_id)
        except KeyError:
            await self.close(code=4004)
            return

        await self.channel_layer.group_add(self._group, self.channel_name)
        await self.accept()
        await self.send_json({"type": "snapshot", **gs.get_snapshot(tournament_id=self.tournament_id)})

    async def disconnect(self, close_code: int) -> None:
        group = getattr(self, "_group", None)
        if group:
            await self.channel_layer.group_discard(group, self.channel_name)

    async def receive(self, text_data: str = "", **kwargs) -> None:
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        tid = self.tournament_id
        msg_type = data.get("type", "")

        if msg_type == "get_snapshot":
            await self.send_json({"type": "snapshot", **gs.get_snapshot(tournament_id=tid)})

        elif msg_type == "admin_start":
            if not await self._require_admin():
                return
            now_ms = time.time() * 1000

            def _run(s):
                if not s["running"]:
                    s["running"] = True
                    s["startedAtMs"] = now_ms
                    return True
                return False

            changed = gs.with_state(_run, tournament_id=tid)
            if changed:
                _schedule_save(tid)
                await self._broadcast_snapshot()
                await self._broadcast({"type": "play_sound", "soundType": "start"})

        elif msg_type == "admin_pause":
            if not await self._require_admin():
                return
            now_ms = time.time() * 1000

            def _run(s):
                if s["running"]:
                    timing = gs.compute_remaining_seconds(s, now_ms)
                    s["elapsedInCurrentSeconds"] = timing["elapsed"]
                    s["running"] = False
                    s["startedAtMs"] = None
                    return True
                return False

            changed = gs.with_state(_run, tournament_id=tid)
            if changed:
                _schedule_save(tid)
                await self._broadcast_snapshot()
                await self._broadcast({"type": "play_sound", "soundType": "pause"})

        elif msg_type == "admin_reset_level":
            if not await self._require_admin():
                return
            now_ms = time.time() * 1000

            def _run(s):
                s["elapsedInCurrentSeconds"] = 0
                s["startedAtMs"] = now_ms if s["running"] else None

            gs.with_state(_run, tournament_id=tid)
            _schedule_save(tid)
            await self._broadcast_snapshot()
            await self._broadcast({"type": "play_sound", "soundType": "reset_level"})

        elif msg_type == "admin_next":
            if not await self._require_admin():
                return
            now_ms = time.time() * 1000

            def _run(s):
                levels = s["tournament"]["levels"]
                if s["currentIndex"] < len(levels) - 1:
                    s["currentIndex"] += 1
                    s["elapsedInCurrentSeconds"] = 0
                    s["startedAtMs"] = now_ms if s["running"] else None
                    return True
                return False

            changed = gs.with_state(_run, tournament_id=tid)
            if changed:
                _schedule_save(tid)
                await self._broadcast_snapshot()
                await self._broadcast({"type": "play_sound", "soundType": "level_advance"})

        elif msg_type == "admin_prev":
            if not await self._require_admin():
                return
            now_ms = time.time() * 1000

            def _run(s):
                if s["currentIndex"] > 0:
                    s["currentIndex"] -= 1
                    s["elapsedInCurrentSeconds"] = 0
                    s["startedAtMs"] = now_ms if s["running"] else None
                    return True
                return False

            changed = gs.with_state(_run, tournament_id=tid)
            if changed:
                _schedule_save(tid)
                await self._broadcast_snapshot()
                await self._broadcast({"type": "play_sound", "soundType": "level_back"})

        elif msg_type == "admin_jump":
            if not await self._require_admin():
                return
            index = data.get("index")
            now_ms = time.time() * 1000

            def _run(s):
                levels = s["tournament"]["levels"]
                try:
                    i = int(index)
                except (TypeError, ValueError):
                    return False
                if 0 <= i < len(levels):
                    s["currentIndex"] = i
                    s["elapsedInCurrentSeconds"] = 0
                    s["startedAtMs"] = now_ms if s["running"] else None
                    return True
                return False

            changed = gs.with_state(_run, tournament_id=tid)
            if changed:
                _schedule_save(tid)
                await self._broadcast_snapshot()
                await self._broadcast({"type": "play_sound", "soundType": "level_jump"})

        elif msg_type == "admin_update_tournament":
            if not await self._require_admin():
                return
            tournament = data.get("tournament")
            now_ms = time.time() * 1000

            if (
                not isinstance(tournament, dict)
                or not isinstance(tournament.get("levels"), list)
                or len(tournament["levels"]) == 0
            ):
                await self.send_json({"type": "error_msg", "message": "Ugyldig turneringsstruktur"})
                return

            for lvl in tournament["levels"]:
                if not isinstance(lvl, dict):
                    continue
                minutes = lvl.get("durationMinutes") if isinstance(lvl.get("durationMinutes"), (int, float)) else lvl.get("minutes")
                if isinstance(minutes, (int, float)) and math.isfinite(minutes) and minutes >= 0:
                    lvl["seconds"] = minutes * 60
                elif isinstance(lvl.get("durationSeconds"), (int, float)):
                    lvl["seconds"] = lvl["durationSeconds"]

            def _run(s):
                s["tournament"] = tournament
                s["currentIndex"] = min(s["currentIndex"], len(tournament["levels"]) - 1)
                s["elapsedInCurrentSeconds"] = 0
                s["startedAtMs"] = now_ms if s["running"] else None

            gs.with_state(_run, tournament_id=tid)
            _schedule_save(tid)
            await self._broadcast_snapshot()

        elif msg_type == "admin_add_time":
            if not await self._require_admin():
                return
            now_ms = time.time() * 1000
            try:
                seconds = int(data.get("seconds", 60))
            except (TypeError, ValueError):
                seconds = 60
            gs.add_time_seconds(seconds, now_ms, tournament_id=tid)
            _schedule_save(tid)
            await self._broadcast_snapshot()

        elif msg_type == "admin_set_players":
            if not await self._require_admin():
                return
            patch = {k: data[k] for k in ("registered", "busted", "rebuyCount", "addOnCount") if k in data}
            gs.update_players(patch, tournament_id=tid)
            _schedule_save(tid)
            await self._broadcast_snapshot()

        elif msg_type == "admin_rebuy":
            if not await self._require_admin():
                return
            snap = gs.get_snapshot(tournament_id=tid)
            gs.update_players({"rebuyCount": snap["players"]["rebuyCount"] + 1}, tournament_id=tid)
            _schedule_save(tid)
            await self._broadcast_snapshot()

        elif msg_type == "admin_add_on":
            if not await self._require_admin():
                return
            snap = gs.get_snapshot(tournament_id=tid)
            gs.update_players({"addOnCount": snap["players"]["addOnCount"] + 1}, tournament_id=tid)
            _schedule_save(tid)
            await self._broadcast_snapshot()

        elif msg_type == "admin_bustout":
            if not await self._require_admin():
                return
            snap = gs.get_snapshot(tournament_id=tid)
            active = snap["players"]["active"]
            if active > 0:
                gs.update_players({"busted": snap["players"]["busted"] + 1}, tournament_id=tid)
                _schedule_save(tid)
                await self._broadcast_snapshot()

    #  Channel-layer receiver 

    async def clock_broadcast(self, event: dict) -> None:
        await self.send_json(event["message"])

    #  Helpers 

    async def _require_admin(self) -> bool:
        if getattr(self, "user", {}).get("role") != "admin":
            await self.send_json({"type": "error_msg", "message": "Ikke autorisert (admin kreves)."})
            return False
        return True

    async def _broadcast_snapshot(self) -> None:
        await self._broadcast({"type": "snapshot", **gs.get_snapshot(tournament_id=self.tournament_id)})

    async def _broadcast(self, message: dict) -> None:
        await self.channel_layer.group_send(
            self._group,
            {"type": "clock.broadcast", "message": message},
        )

    async def send_json(self, data: dict) -> None:
        await self.send(text_data=json.dumps(data))
