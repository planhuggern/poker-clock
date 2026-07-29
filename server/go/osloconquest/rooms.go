package osloconquest

import (
	"errors"
	"strings"
)

var ErrRoomFull = errors.New("room is full")

var ErrInvalidPlayer = errors.New("player ID is required")

func NewWaitingRoom(id string, player Player) Room {
	return Room{
		ID:          id,
		Players:     []Player{player},
		Territories: make(map[MapNodeID]MapNode),
		Phase:       PhaseWaiting,
		Log: []LogEntry{
			{Message: "Venter på spiller 2", Type: "info"},
		},
	}
}

func AddPlayer(room Room, player Player) (Room, error) {
	if strings.TrimSpace(string(player.ID)) == "" {
		return room, ErrInvalidPlayer
	}

	if len(room.Players) >= MaxPlayers {
		return room, ErrRoomFull
	}

	players := make([]Player, len(room.Players), len(room.Players)+1)
	copy(players, room.Players)
	room.Players = append(players, player)

	return room, nil
}

func findRoomWithPlayer(
	rooms map[string]Room,
	playerID PlayerID,
	excludeRoomID string,
) (string, bool) {
	if strings.TrimSpace(string(playerID)) == "" {
		return "", false
	}

	for roomID, room := range rooms {
		if roomID == excludeRoomID {
			continue
		}

		for _, player := range room.Players {
			if player.ID == playerID {
				return roomID, true
			}
		}
	}

	return "", false
}
