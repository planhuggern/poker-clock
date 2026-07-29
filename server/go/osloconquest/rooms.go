package osloconquest

import (
	"errors"
	"fmt"
	"maps"
	"strings"
)

var ErrRoomFull = errors.New("room is full")
var ErrRoomExists = errors.New("room already exists")
var ErrInvalidPlayer = errors.New("player ID is required")
var ErrPlayerAlreadyInRoom = errors.New("player is already in a room")

func isBlankPlayerID(playerID PlayerID) bool {
	return strings.TrimSpace(string(playerID)) == ""
}

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

func createWaitingRoom(rooms map[string]Room, id string, player Player) (map[string]Room, error) {
	if isBlankPlayerID(player.ID) {
		return rooms, ErrInvalidPlayer
	}

	if _, exists := rooms[id]; exists {
		return rooms, ErrRoomExists
	}

	_, playerAlreadyInRoom := findRoomWithPlayer(rooms, player.ID, "")
	if playerAlreadyInRoom {
		return rooms, ErrPlayerAlreadyInRoom
	}

	updatedRooms := make(map[string]Room, len(rooms)+1)
	maps.Copy(updatedRooms, rooms)
	room := NewWaitingRoom(id, player)
	updatedRooms[id] = room
	return updatedRooms, nil
}

func AddPlayer(room Room, player Player) (Room, error) {
	if isBlankPlayerID(player.ID) {
		return room, ErrInvalidPlayer
	}

	if len(room.Players) >= MaxPlayers {
		return room, ErrRoomFull
	}

	players := make([]Player, len(room.Players), len(room.Players)+1)
	copy(players, room.Players)
	room.Players = append(players, player)

	if len(room.Players) == MaxPlayers {
		room.Log = append(room.Log, LogEntry{Message: "Rommet er fullt. Kjører setup!", Type: "info"})
		room.Phase = PhaseSetup
		room.Started = true
		room.ActivePlayer = &room.Players[0].ID
	}

	return room, nil
}

func findRoomWithPlayer(
	rooms map[string]Room,
	playerID PlayerID,
	excludeRoomID string,
) (string, bool) {
	if isBlankPlayerID(playerID) {
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

func summarizeRooms(rooms map[string]Room) []RoomInfo {
	roomInfos := make([]RoomInfo, 0, len(rooms))
	for _, room := range rooms {
		var status string
		if room.Started {
			status = "started"
		} else {
			status = "waiting"
		}

		info := RoomInfo{
			Room:        room.ID,
			PlayerCount: len(room.Players),
			MaxPlayers:  MaxPlayers,
			Started:     room.Started,
			Phase:       room.Phase,
			Status:      status,
			OwnerID:     room.Players[0].ID,
			PlayerIDs:   make([]PlayerID, len(room.Players)),
			Players:     make([]string, len(room.Players)),
		}
		for i, player := range room.Players {
			info.PlayerIDs[i] = player.ID
			info.Players[i] = player.Name
		}
		roomInfos = append(roomInfos, info)
	}
	return roomInfos
}

func NewBotRoom(id string, player Player) (Room, error) {
	if isBlankPlayerID(player.ID) {
		return Room{}, ErrInvalidPlayer
	}

	room := NewWaitingRoom(id, player)
	for i := 1; i < MaxPlayers; i++ {
		bot := Player{
			ID:    PlayerID(fmt.Sprintf("bot-%d", i)),
			Name:  fmt.Sprintf("Bot %d", i),
			IsBot: true,
		}
		room, _ = AddPlayer(room, bot)
	}
	return room, nil
}
