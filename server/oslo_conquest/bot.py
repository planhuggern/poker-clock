"""Bot player for Oslo Conquest.

Returns action dicts without mutating game state.
The consumer applies the returned action through the normal mvp.py functions.
"""
import random

from .board import CHECKPOINT_IDS

BOT_PLAYER_ID = "bot-blue"
BOT_PLAYER_NAME = "Bot"


def get_bot_action(room_state: dict, bot_player_id: str) -> dict | None:
    """Return the next action for the bot, or None if no action is needed."""
    player = _find_player(room_state, bot_player_id)
    if not player:
        return None
    if player.get("side") != room_state.get("activePlayer"):
        return None

    phase = room_state.get("phase")

    if phase == "setup":
        if player.get("position") is None:
            return {"type": "choose_start_checkpoint", "checkpointId": random.choice(CHECKPOINT_IDS)}
        return {"type": "end_turn"}

    if phase == "playing":
        return {"type": "end_turn"}

    return None


def _find_player(room_state: dict, player_id: str) -> dict | None:
    return next(
        (p for p in room_state.get("players", []) if p.get("id") == player_id),
        None,
    )
