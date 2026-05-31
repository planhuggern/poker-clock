"""Minimal server-authoritative rules for Oslo Conquest MVP."""

import random

from .board import ADJACENCY, CHECKPOINT_IDS, START_TERRITORIES, TERRITORY_IDS

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
        "position": None,
        "diceRoll": None,
        "movesRemaining": 0,
        "validMoves": [],
        "setupConfirmed": False,
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
        if territory_id in CHECKPOINT_IDS:
            territories[territory_id] = {"id": territory_id, "owner": None, "units": 0}
        else:
            territories[territory_id] = {"id": territory_id, "owner": None, "units": 1}

    for side, territory_id in START_TERRITORIES.items():
        territories[territory_id]["owner"] = side
        territories[territory_id]["units"] = 3

    for player in room_state.get("players", []):
        player["position"] = None
        player["diceRoll"] = None
        player["movesRemaining"] = 0
        player["validMoves"] = []
        player["setupConfirmed"] = False

    room_state.update(
        {
            "phase": "setup",
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

    if room_state.get("phase") == "setup":
        if player.get("position") is None:
            return room_state, "Velg startcheckpoint før du avslutter turen"

        player["setupConfirmed"] = True
        next_side = _next_setup_side(room_state)
        if next_side:
            room_state["activePlayer"] = next_side
            next_player = next(
                p
                for p in room_state["players"]
                if p["side"] == room_state["activePlayer"]
            )
            room_state.setdefault("log", []).insert(
                0,
                log_entry(f"{next_player['name']} velger startcheckpoint"),
            )
            return room_state, None

        room_state["phase"] = "playing"
        room_state["activePlayer"] = "red"
        room_state.setdefault("log", []).insert(
            0,
            log_entry("Alle spillere har valgt startcheckpoint. Runde 1 starter."),
        )
        return room_state, None

    if room_state.get("phase") != "playing":
        return room_state, "Velg startcheckpoint før første runde"

    player["diceRoll"] = None
    player["movesRemaining"] = 0
    player["validMoves"] = []

    room_state["activePlayer"] = "blue" if active_side == "red" else "red"
    next_player = next(
        p for p in room_state["players"] if p["side"] == room_state["activePlayer"]
    )
    room_state.setdefault("log", []).insert(
        0,
        log_entry(f"{next_player['name']} sin tur"),
    )
    return room_state, None


def roll_dice(room_state: dict, player_id: str | None) -> tuple[dict, str | None]:
    if not room_state.get("started"):
        return room_state, "Spillet har ikke startet"

    if room_state.get("phase") != "playing":
        return room_state, "Velg startcheckpoint før første runde"

    player = find_player_by_id(room_state, player_id)
    if not player:
        return room_state, "Ukjent spiller"

    if player.get("side") != room_state.get("activePlayer"):
        return room_state, "Det er ikke din tur"

    if player.get("position") is None:
        return room_state, "Velg startcheckpoint først"

    if player.get("diceRoll") is not None:
        return room_state, "Du har allerede kastet denne turen"

    dice_roll = random.randint(1, 6)
    position = player.get("position")

    player["diceRoll"] = dice_roll
    player["movesRemaining"] = dice_roll
    player["validMoves"] = _reachable_territories(position, dice_roll)

    room_state.setdefault("log", []).insert(
        0,
        log_entry(f"{player['name']} kastet {dice_roll}"),
    )

    return room_state, None


def choose_start_checkpoint(
    room_state: dict,
    player_id: str | None,
    checkpoint_territory_id: str | None,
) -> tuple[dict, str | None]:
    if not room_state.get("started"):
        return room_state, "Spillet har ikke startet"

    if room_state.get("phase") != "setup":
        return room_state, "Startcheckpoint er allerede valgt"

    player = find_player_by_id(room_state, player_id)
    if not player:
        return room_state, "Ukjent spiller"

    if player.get("side") != room_state.get("activePlayer"):
        return room_state, "Det er ikke din tur"

    if player.get("setupConfirmed"):
        return room_state, "Startcheckpoint er allerede låst"

    checkpoint_id = str(checkpoint_territory_id or "")
    if checkpoint_id not in CHECKPOINT_IDS:
        return room_state, "Ugyldig checkpoint"

    player["position"] = checkpoint_id
    player["diceRoll"] = None
    player["movesRemaining"] = 0
    player["validMoves"] = []
    player["setupConfirmed"] = False
    room_state.setdefault("log", []).insert(
        0,
        log_entry(f"{player['name']} flyttet startbrikken til {checkpoint_id}"),
    )

    return room_state, None


def move(
    room_state: dict,
    player_id: str | None,
    to_territory_id: str | None,
) -> tuple[dict, str | None]:
    if not room_state.get("started"):
        return room_state, "Spillet har ikke startet"

    if room_state.get("phase") != "playing":
        return room_state, "Velg startcheckpoint før første runde"

    player = find_player_by_id(room_state, player_id)
    if not player:
        return room_state, "Ukjent spiller"

    if player.get("side") != room_state.get("activePlayer"):
        return room_state, "Det er ikke din tur"

    destination = str(to_territory_id or "")
    if destination not in TERRITORY_IDS:
        return room_state, "Ugyldig territorium"

    if player.get("diceRoll") is None:
        return room_state, "Du må kaste terning først"

    valid_moves = player.get("validMoves") or []
    if destination not in valid_moves:
        return room_state, "Territoriet er utenfor rekkevidde"

    player["position"] = destination
    player["movesRemaining"] = 0
    player["validMoves"] = []

    room_state.setdefault("log", []).insert(
        0,
        log_entry(f"{player['name']} flyttet til {destination}"),
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

    if room_state.get("phase") != "playing":
        return room_state, "Velg startcheckpoint før første runde"

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

    if from_id in CHECKPOINT_IDS or to_id in CHECKPOINT_IDS:
        return room_state, "Checkpoint kan ikke angripes"

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


def _reachable_territories(start_id: str | None, max_steps: int) -> list[str]:
    if not start_id or max_steps <= 0:
        return []

    visited: dict[str, int] = {start_id: 0}
    queue: list[str] = [start_id]

    while queue:
        node = queue.pop(0)
        depth = visited[node]
        if depth >= max_steps:
            continue

        for neighbor in ADJACENCY.get(node, []):
            if neighbor not in TERRITORY_IDS:
                continue
            if neighbor in visited and visited[neighbor] <= depth + 1:
                continue
            visited[neighbor] = depth + 1
            queue.append(neighbor)

    return sorted([territory_id for territory_id, dist in visited.items() if dist > 0])


def _next_setup_side(room_state: dict) -> str | None:
    for side in PLAYER_SIDES:
        player = next(
            (item for item in room_state.get("players", []) if item.get("side") == side),
            None,
        )
        if player and not player.get("setupConfirmed"):
            return side
    return None


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
