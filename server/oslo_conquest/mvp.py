"""Minimal server-authoritative rules for Oslo Conquest MVP."""

from .board import ADJACENCY, START_TERRITORIES, TERRITORY_IDS

PLAYER_SIDES = ("red", "blue")
MAX_PLAYERS = len(PLAYER_SIDES)
PLAYER_COLORS = {
    "red": "#c0392b",
    "blue": "#1a6b9a",
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
    return next(
        (p for p in room_state.get("players", []) if p.get("id") == player_id),
        None,
    )


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
    next_player = next(
        p for p in room_state["players"] if p["side"] == room_state["activePlayer"]
    )
    room_state.setdefault("log", []).insert(
        0,
        log_entry(f"{next_player['name']} sin tur"),
    )
    return room_state, None


def attack(
    room_state: dict,
    player_id: str | None,
    from_territory_id: str | None,
    to_territory_id: str | None,
) -> tuple[dict, str | None]:
    if not room_state.get("started"):
        return room_state, "Spillet har ikke startet"

    player = find_player_by_id(room_state, player_id)
    if not player:
        return room_state, "Ukjent spiller"

    active_side = room_state.get("activePlayer")
    if player.get("side") != active_side:
        return room_state, "Det er ikke din tur"

    from_id = str(from_territory_id or "")
    to_id = str(to_territory_id or "")
    territories = room_state.get("territories") or {}

    if from_id not in territories or to_id not in territories:
        return room_state, "Ugyldig territorium"

    if to_id not in ADJACENCY.get(from_id, []):
        return room_state, "Territoriene er ikke naboer"

    attacker = territories[from_id]
    defender = territories[to_id]
    attacker_side = player["side"]

    if attacker.get("owner") != attacker_side:
        return room_state, "Du eier ikke angrepsterritoriet"

    if defender.get("owner") == attacker_side:
        return room_state, "Du kan ikke angripe eget territorium"

    if int(attacker.get("units", 0)) < 2:
        return room_state, "Du trenger minst 2 units for å angripe"

    attacker_units = int(attacker.get("units", 0))
    defender_units = int(defender.get("units", 0))

    attacker["units"] = attacker_units - 1

    if attacker_units > defender_units:
        defender["owner"] = attacker_side
        defender["units"] = 1
        room_state.setdefault("log", []).insert(
            0,
            log_entry(f"{player['name']} erobret {to_id}"),
        )
        _update_winner(room_state)
    else:
        room_state.setdefault("log", []).insert(
            0,
            log_entry(f"{player['name']} mislyktes i angrep på {to_id}"),
        )

    return room_state, None


def _update_winner(room_state: dict) -> None:
    territories = room_state.get("territories") or {}
    total = len(territories)
    if total <= 0:
        return

    side_counts = {
        "red": 0,
        "blue": 0,
    }
    for territory in territories.values():
        owner = territory.get("owner")
        if owner in side_counts:
            side_counts[owner] += 1

    win_threshold = int(total * 0.6 + 0.999999)
    for side, count in side_counts.items():
        if count >= win_threshold:
            room_state["winner"] = side
            break


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
                "status": (
                    "started" if started or len(players) >= MAX_PLAYERS else "waiting"
                ),
                "players": [p.get("name", "Ukjent") for p in players],
            }
        )
    return summaries
