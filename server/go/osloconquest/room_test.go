package osloconquest

import (
	"fmt"
	"testing"
)

func fillRoomWithPlayers(numPlayers int) Room {
	room := NewWaitingRoom("room-1", Player{
		ID:   "player-1",
		Name: "Espen",
	})

	for playerNumber := 2; playerNumber <= numPlayers; playerNumber++ {
		updatedRoom, err := AddPlayer(room, Player{
			ID:   PlayerID(fmt.Sprintf("player-%d", playerNumber)),
			Name: fmt.Sprintf("Player %d", playerNumber),
		})
		if err != nil {
			panic(fmt.Sprintf("adding player %d: %v", playerNumber, err))
		}
		room = updatedRoom
	}
	return room
}

func TestCheckpointsAreMapNodes(t *testing.T) {
	for _, checkpointID := range CheckpointIDs {
		if !containsMapNodeID(MapNodeIDs, checkpointID) {
			t.Errorf("checkpoint %q is not a map node", checkpointID)
		}
	}
}

func TestAdjacencyIsSymmetric(t *testing.T) {
	for _, nodeID := range MapNodeIDs {
		neighbors, exists := Adjacency[nodeID]
		if !exists {
			t.Errorf("map node %q has no adjacency entry", nodeID)
			continue
		}

		for _, neighborID := range neighbors {
			reverseNeighbors := Adjacency[neighborID]
			if !containsMapNodeID(reverseNeighbors, nodeID) {
				t.Errorf("%q lists %q, but not the reverse", nodeID, neighborID)
			}
		}
	}
}

func TestNewWaitingRoom(t *testing.T) {
	player := Player{
		ID:   "player-1",
		Name: "Espen",
	}

	room := NewWaitingRoom("room-1", player)

	if room.ID != "room-1" {
		t.Errorf("room ID = %q, want %q", room.ID, "room-1")
	}
	if room.Phase != PhaseWaiting {
		t.Errorf("phase = %q, want %q", room.Phase, PhaseWaiting)
	}
	if room.Started {
		t.Error("waiting room should not be started")
	}
	if room.ActivePlayer != nil {
		t.Error("waiting room should not have an active player")
	}
	if len(room.Players) != 1 {
		t.Errorf("player count = %d, want 1", len(room.Players))
	}
}

func TestAddPlayerAddsSecondPlayer(t *testing.T) {
	room := NewWaitingRoom("room-1", Player{
		ID:   "player-1",
		Name: "Espen",
	})

	updatedRoom, err := AddPlayer(room, Player{
		ID:   "player-2",
		Name: "Ada",
	})

	if err != nil {
		t.Fatalf("AddPlayer returned an error: %v", err)
	}
	if len(updatedRoom.Players) != 2 {
		t.Errorf("player count = %d, want 2", len(updatedRoom.Players))
	}
}

func TestAddPlayerRejectsPlayerWhenRoomIsFull(t *testing.T) {
	room := fillRoomWithPlayers(MaxPlayers)

	updatedRoom, err := AddPlayer(room, Player{
		ID:   PlayerID("player-too-many"),
		Name: "Lin",
	})

	if err != ErrRoomFull {
		t.Errorf("error = %v, want ErrRoomFull", err)
	}
	if len(updatedRoom.Players) != MaxPlayers {
		t.Errorf("player count = %d, want %d", len(updatedRoom.Players), MaxPlayers)
	}
}

func TestAddPlayerRejectsBlankPlayerID(t *testing.T) {
	room := NewWaitingRoom("room-1", Player{
		ID:   "player-1",
		Name: "Espen",
	})

	updatedRoom, err := AddPlayer(room, Player{
		Name: "Anonymous",
	})

	if err != ErrInvalidPlayer {
		t.Errorf("error = %v, want ErrInvalidPlayer", err)
	}
	if len(updatedRoom.Players) != 1 {
		t.Errorf("player count = %d, want 1", len(updatedRoom.Players))
	}
}

func TestFindRoomWithPlayer(t *testing.T) {
	rooms := map[string]Room{
		"room-1": NewWaitingRoom("room-1", Player{
			ID:   "player-1",
			Name: "Espen",
		}),
		"room-2": NewWaitingRoom("room-2", Player{
			ID:   "player-2",
			Name: "Ada",
		}),
	}

	roomID, found := findRoomWithPlayer(rooms, "player-2", "")

	if !found {
		t.Fatal("player should be in a room")
	}
	if roomID != "room-2" {
		t.Errorf("room ID = %q, want %q", roomID, "room-2")
	}
}

func TestFindRoomWithPlayerIgnoresExcludedRoom(t *testing.T) {
	rooms := map[string]Room{
		"room-1": NewWaitingRoom("room-1", Player{
			ID:   "player-1",
			Name: "Espen",
		}),
	}

	_, found := findRoomWithPlayer(rooms, "player-1", "room-1")

	if found {
		t.Fatal("player should not be found in the excluded room")
	}
}

func TestSummarizeRooms(t *testing.T) {
	rooms := map[string]Room{
		"room-1": NewWaitingRoom("room-1", Player{
			ID:   "player-1",
			Name: "Espen",
		}),
	}

	roomInfos := summarizeRooms(rooms)

	if len(roomInfos) != 1 {
		t.Fatalf("room count = %d, want 1", len(roomInfos))
	}

	info := roomInfos[0]
	if info.Room != "room-1" {
		t.Errorf("room = %q, want %q", info.Room, "room-1")
	}
	if info.PlayerCount != 1 {
		t.Errorf("player count = %d, want 1", info.PlayerCount)
	}
	if info.MaxPlayers != MaxPlayers {
		t.Errorf("max players = %d, want %d", info.MaxPlayers, MaxPlayers)
	}
	if info.Status != "waiting" {
		t.Errorf("status = %q, want %q", info.Status, "waiting")
	}
	if len(info.Players) != 1 || info.Players[0] != "Espen" {
		t.Errorf("players = %v, want [Espen]", info.Players)
	}
}

func TestSummarizeRoomsMarksStartedRooms(t *testing.T) {
	room := NewWaitingRoom("room-1", Player{
		ID:   "player-1",
		Name: "Espen",
	})
	room.Started = true
	room.Phase = PhaseSetup

	roomInfos := summarizeRooms(map[string]Room{
		"room-1": room,
	})

	if roomInfos[0].Status != "started" {
		t.Errorf("status = %q, want %q", roomInfos[0].Status, "started")
	}
}

func TestFullRoomStartsSetup(t *testing.T) {
	room := fillRoomWithPlayers(MaxPlayers)

	if !room.Started {
		t.Error("room should be started when it reaches MaxPlayers")
	}
	if room.Phase != PhaseSetup {
		t.Errorf("phase = %q, want %q", room.Phase, PhaseSetup)
	}
	if room.ActivePlayer == nil {
		t.Fatal("started room should have an active player")
	}
	if *room.ActivePlayer != "player-1" {
		t.Errorf("active player = %q, want %q", *room.ActivePlayer, "player-1")
	}
}
