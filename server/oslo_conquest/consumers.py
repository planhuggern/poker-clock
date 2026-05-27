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

from .mvp import (
    add_player,
    attack,
    choose_start_checkpoint,
    create_waiting_room,
    end_turn,
    move,
    roll_dice,
    summarize_rooms,
)

# In-memory room storage: { room_id: latest_game_state }
_rooms: dict[str, dict] = {}


class OsloConquestConsumer(AsyncWebsocketConsumer):

    async def connect(self) -> None:
        self.room: str | None = None
        self.player_id: str | None = None
        await self.accept()

    async def disconnect(self, close_code: int) -> None:
        if self.room:
            await self.channel_layer.group_discard(
                self._group_name(self.room),
                self.channel_name,
            )

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
        elif msg_type == "end_turn":
            await self._handle_end_turn(data)
        elif msg_type == "attack":
            await self._handle_attack(data)
        elif msg_type == "roll_dice":
            await self._handle_roll_dice(data)
        elif msg_type == "move":
            await self._handle_move(data)
        elif msg_type == "choose_start_checkpoint":
            await self._handle_choose_start_checkpoint(data)
        elif msg_type == "list_rooms":
            await self._handle_list_rooms()
        elif msg_type == "game_action":
            await self._handle_action(data)

    # ── Handlers ─────────────────────────────────────────────────────────────

    async def _handle_create(self, data: dict) -> None:
        room = str(data.get("room") or "default")
        player = data.get("player") or {}
        self.player_id = str(player.get("id") or "")
        await self._join_group(room)
        _rooms[room] = create_waiting_room(room, player)
        await self._broadcast(room, {"type": "game_state", "state": _rooms[room]})

    async def _handle_join(self, data: dict) -> None:
        room = str(data.get("room") or "default")
        player = data.get("player") or {}
        self.player_id = str(player.get("id") or "")
        await self._join_group(room)
        if room not in _rooms:
            _rooms[room] = create_waiting_room(room, player)
        else:
            _rooms[room], error = add_player(_rooms[room], player)
            if error:
                await self.send(
                    text_data=json.dumps({"type": "error", "message": error})
                )
                return
        await self._broadcast(room, {"type": "game_state", "state": _rooms[room]})

    async def _handle_action(self, data: dict) -> None:
        if not self.room:
            return
        if _rooms.get(self.room, {}).get("activePlayer"):
            await self.send(
                text_data=json.dumps(
                    {"type": "error", "message": "Serveren styrer MVP-state"}
                )
            )
            return
        state = data.get("state") or {}
        _rooms[self.room] = state
        await self._broadcast(self.room, {"type": "game_state", "state": state})

    async def _handle_end_turn(self, data: dict) -> None:
        if not self.room or self.room not in _rooms:
            return
        player_id = str(data.get("playerId") or self.player_id or "")
        _rooms[self.room], error = end_turn(_rooms[self.room], player_id)
        if error:
            await self.send(text_data=json.dumps({"type": "error", "message": error}))
            return
        await self._broadcast(
            self.room,
            {"type": "game_state", "state": _rooms[self.room]},
        )

    async def _handle_attack(self, data: dict) -> None:
        if not self.room or self.room not in _rooms:
            return
        player_id = str(data.get("playerId") or self.player_id or "")
        from_territory_id = data.get("fromTerritoryId") or data.get("from_id")
        to_territory_id = data.get("toTerritoryId") or data.get("to_id")
        _rooms[self.room], error = attack(
            _rooms[self.room],
            player_id,
            from_territory_id,
            to_territory_id,
        )
        if error:
            await self.send(text_data=json.dumps({"type": "error", "message": error}))
            return
        await self._broadcast(
            self.room,
            {"type": "game_state", "state": _rooms[self.room]},
        )

    async def _handle_roll_dice(self, data: dict) -> None:
        if not self.room or self.room not in _rooms:
            return
        player_id = str(data.get("playerId") or self.player_id or "")
        _rooms[self.room], error = roll_dice(_rooms[self.room], player_id)
        if error:
            await self.send(text_data=json.dumps({"type": "error", "message": error}))
            return
        await self._broadcast(
            self.room,
            {"type": "game_state", "state": _rooms[self.room]},
        )

    async def _handle_move(self, data: dict) -> None:
        if not self.room or self.room not in _rooms:
            return
        player_id = str(data.get("playerId") or self.player_id or "")
        to_territory_id = data.get("toTerritoryId") or data.get("to_id")
        _rooms[self.room], error = move(_rooms[self.room], player_id, to_territory_id)
        if error:
            await self.send(text_data=json.dumps({"type": "error", "message": error}))
            return
        await self._broadcast(
            self.room,
            {"type": "game_state", "state": _rooms[self.room]},
        )

    async def _handle_choose_start_checkpoint(self, data: dict) -> None:
        if not self.room or self.room not in _rooms:
            return
        player_id = str(data.get("playerId") or self.player_id or "")
        checkpoint_id = data.get("checkpointTerritoryId") or data.get("checkpoint_id")
        _rooms[self.room], error = choose_start_checkpoint(
            _rooms[self.room],
            player_id,
            checkpoint_id,
        )
        if error:
            await self.send(text_data=json.dumps({"type": "error", "message": error}))
            return
        await self._broadcast(
            self.room,
            {"type": "game_state", "state": _rooms[self.room]},
        )

    async def _handle_list_rooms(self) -> None:
        await self._send_room_list()

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
            await self.channel_layer.group_discard(
                self._group_name(self.room),
                self.channel_name,
            )
        self.room = room
        await self.channel_layer.group_add(self._group_name(room), self.channel_name)

    async def _broadcast(self, room: str, message: dict) -> None:
        await self.channel_layer.group_send(
            self._group_name(room),
            {"type": "oslo.broadcast", "message": message},
        )

    async def _send_room_list(self) -> None:
        await self.send(
            text_data=json.dumps(
                {"type": "room_list", "rooms": summarize_rooms(_rooms)}
            )
        )
