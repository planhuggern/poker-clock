package osloconquest

import "errors"

var ErrRoomFull = errors.New("room is full")

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
	if len(room.Players) >= MaxPlayers {
		return room, ErrRoomFull
	}

	players := make([]Player, len(room.Players), len(room.Players)+1)
	copy(players, room.Players)
	room.Players = append(players, player)

	return room, nil
}
