"""Minimal server-authoritative rules for Oslo Conquest MVP."""

PLAYER_SIDES = ("red", "blue")
MAX_PLAYERS = len(PLAYER_SIDES)
PLAYER_COLORS = {
    "red": "#c0392b",
    "blue": "#1a6b9a",
}

TERRITORY_IDS = (
    "t0a", "t0b", "t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8",
    "t9", "t10", "t11", "t12", "t13", "t14", "t15", "t16", "t17",
    "t18", "t19", "t20", "t21", "t22", "t23", "t24", "t25", "t26",
    "t27", "t28", "t29", "t30", "t31", "t32", "t33", "t34", "t35",
)

START_TERRITORIES = {
    "red": "t0a",
    "blue": "t35",
}


def create_waiting_room(room: str, player: dict) -> dict:
    return {
        "room": room,
        "phase": "waiting",
        "started": False,
        "activePlayer": None,
        "players": [assign_player(player, "red")],
        "territories": {},
        "log": [log_entry("Venter på spiller 2")],
    }


def assign_player(player: dict, side: str) -> dict:
    return {
        "id": str(player.get("id") or side),
        "name": str(player.get("name") or side.title()),
        "side": side,
        "color": PLAYER_COLORS[side],
        "colorName": "Rød" if side == "red" else "Blå",
    }


def add_player(room_state: dict, player: dict) -> tuple[dict, str | None]:
    existing = find_player_by_id(room_state, player.get("id"))
    if existing:
        return room_state, None

    if len(room_state["players"]) >= len(PLAYER_SIDES):
        return room_state, "Rommet er fullt"

    side = PLAYER_SIDES[len(room_state["players"])]
    room_state["players"].append(assign_player(player, side))

    if len(room_state["players"]) == len(PLAYER_SIDES):
        start_game(room_state)

    return room_state, None


def find_player_by_id(room_state: dict, player_id: str | None) -> dict | None:
    if not player_id:
        return None
    return next((p for p in room_state.get("players", []) if p.get("id") == player_id), None)


def start_game(room_state: dict) -> dict:
    territories = {}
    for territory_id in TERRITORY_IDS:
        territories[territory_id] = {"id": territory_id, "owner": None, "units": 1}

    for side, territory_id in START_TERRITORIES.items():
        territories[territory_id]["owner"] = side
        territories[territory_id]["units"] = 3

    room_state.update(
        {
            "phase": "playing",
            "started": True,
            "activePlayer": "red",
            "territories": territories,
            "log": [log_entry("Spillet startet"), *room_state.get("log", [])],
        }
    )
    return room_state


def end_turn(room_state: dict, player_id: str | None) -> tuple[dict, str | None]:
    if not room_state.get("started"):
        return room_state, "Spillet har ikke startet"

    player = find_player_by_id(room_state, player_id)
    if not player:
        return room_state, "Ukjent spiller"

    active_side = room_state.get("activePlayer")
    if player.get("side") != active_side:
        return room_state, "Det er ikke din tur"

    room_state["activePlayer"] = "blue" if active_side == "red" else "red"
    next_player = next(p for p in room_state["players"] if p["side"] == room_state["activePlayer"])
    room_state.setdefault("log", []).insert(0, log_entry(f"{next_player['name']} sin tur"))
    return room_state, None


def log_entry(message: str) -> dict:
    return {"msg": message, "type": "important", "time": ""}


def summarize_rooms(rooms: dict[str, dict]) -> list[dict]:
    summaries = []
    for room_id, room_state in sorted(rooms.items()):
        players = room_state.get("players", [])
        started = bool(room_state.get("started"))
        summaries.append(
            {
                "room": room_id,
                "playerCount": len(players),
                "maxPlayers": MAX_PLAYERS,
                "started": started,
                "phase": room_state.get("phase", "waiting"),
                "status": "started" if started or len(players) >= MAX_PLAYERS else "waiting",
                "players": [p.get("name", "Ukjent") for p in players],
            }
        )
    return summaries
