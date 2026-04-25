"""
WebSocket consumer for Oslo Conquest.

URL: ws://host/ws/oslo-conquest/

Message protocol:
  Client → Server:
    { "type": "create_game", "room": "oslo-1", "player": { "id": "p1", "name": "Ola" } }
    { "type": "join_game",   "room": "oslo-1", "player": { "id": "p2", "name": "Kari" } }
    { "type": "game_action", "state": { ...full gameState... } }

  Server → Client:
    { "type": "game_state", "state": { ...full gameState... } }
"""
import json

from channels.generic.websocket import AsyncWebsocketConsumer

# In-memory room storage: { room_id: latest_game_state }
_rooms: dict[str, dict] = {}


class OsloConquestConsumer(AsyncWebsocketConsumer):

    async def connect(self) -> None:
        self.room: str | None = None
        await self.accept()

    async def disconnect(self, close_code: int) -> None:
        if self.room:
            await self.channel_layer.group_discard(self._group_name(self.room), self.channel_name)

    async def receive(self, text_data: str = "", **kwargs) -> None:
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get("type")

        if msg_type == "create_game":
            await self._handle_create(data)
        elif msg_type == "join_game":
            await self._handle_join(data)
        elif msg_type == "game_action":
            await self._handle_action(data)

    # ── Handlers ─────────────────────────────────────────────────────────────

    async def _handle_create(self, data: dict) -> None:
        room = str(data.get("room") or "default")
        player = data.get("player") or {}
        await self._join_group(room)
        _rooms[room] = {"room": room, "players": [player], "started": False}
        await self._broadcast(room, {"type": "game_state", "state": _rooms[room]})

    async def _handle_join(self, data: dict) -> None:
        room = str(data.get("room") or "default")
        player = data.get("player") or {}
        await self._join_group(room)
        if room not in _rooms:
            _rooms[room] = {"room": room, "players": [], "started": False}
        existing_ids = {p.get("id") for p in _rooms[room].get("players", [])}
        if player.get("id") not in existing_ids:
            _rooms[room]["players"].append(player)
        await self._broadcast(room, {"type": "game_state", "state": _rooms[room]})

    async def _handle_action(self, data: dict) -> None:
        if not self.room:
            return
        state = data.get("state") or {}
        _rooms[self.room] = state
        await self._broadcast(self.room, {"type": "game_state", "state": state})

    # ── Channel-layer receiver ────────────────────────────────────────────────

    async def oslo_broadcast(self, event: dict) -> None:
        await self.send(text_data=json.dumps(event["message"]))

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _group_name(room: str) -> str:
        safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in room)
        return f"oslo-conquest-{safe}"

    async def _join_group(self, room: str) -> None:
        if self.room and self.room != room:
            await self.channel_layer.group_discard(self._group_name(self.room), self.channel_name)
        self.room = room
        await self.channel_layer.group_add(self._group_name(room), self.channel_name)

    async def _broadcast(self, room: str, message: dict) -> None:
        await self.channel_layer.group_send(
            self._group_name(room),
            {"type": "oslo.broadcast", "message": message},
        )
