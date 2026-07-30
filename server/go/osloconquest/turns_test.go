package osloconquest

import (
	"testing"
)

func TestChooseStartCheckpointSetsActivePlayerPosition(t *testing.T) {
	room := fillRoomWithPlayers(MaxPlayers)
	actorID := *room.ActivePlayerID

	updatedRoom, err := ChooseStartCheckpoint(
		room,
		actorID,
		"lysaker_cp",
	)
	if err != nil {
		t.Fatalf("ChooseStartCheckpoint returned an error: %v", err)
	}
	if room.Players[0].Position != nil {
		t.Error("input room should not be mutated")
	}

	var activePlayer *Player
	for i := range updatedRoom.Players {
		if updatedRoom.Players[i].ID == actorID {
			activePlayer = &updatedRoom.Players[i]
		}
	}

	if activePlayer == nil {
		t.Fatal("active player not found")
	}
	if activePlayer.Position == nil {
		t.Fatal("active player should have a position")
	}
	if *activePlayer.Position != "lysaker_cp" {
		t.Errorf(
			"position = %q, want %q",
			*activePlayer.Position,
			"lysaker_cp",
		)
	}
	if activePlayer.NextCheckpoint == nil {
		t.Fatal("active player should have a next checkpoint")
	}
	if *activePlayer.NextCheckpoint != "kolbotn_cp" {
		t.Errorf(
			"next checkpoint = %q, want %q",
			*activePlayer.NextCheckpoint,
			"kolbotn_cp",
		)
	}
	if activePlayer.SetupConfirmed {
		t.Error("player should not be setup-confirmed before ending the turn")
	}
}

func TestChooseStartCheckpointRejectsNonCheckpoint(t *testing.T) {
	room := fillRoomWithPlayers(MaxPlayers)
	actorID := *room.ActivePlayerID

	updatedRoom, err := ChooseStartCheckpoint(room, actorID, "t1")

	if err != ErrInvalidCheckpoint {
		t.Errorf("error = %v, want ErrInvalidCheckpoint", err)
	}
	if updatedRoom.Players[0].Position != nil {
		t.Error("player should not get a position")
	}
}

func TestChooseStartCheckpointRejectsNonActivePlayer(t *testing.T) {
	room := fillRoomWithPlayers(MaxPlayers)
	nonActivePlayerID := room.Players[1].ID

	updatedRoom, err := ChooseStartCheckpoint(
		room,
		nonActivePlayerID,
		"lysaker_cp",
	)

	if err != ErrNotActivePlayer {
		t.Errorf("error = %v, want ErrNotActivePlayer", err)
	}
	if updatedRoom.Players[1].Position != nil {
		t.Error("non-active player should not get a position")
	}
}

func TestChooseStartCheckpointRejectsWaitingRoom(t *testing.T) {
	player := Player{
		ID:   "player-1",
		Name: "Espen",
	}
	room := NewWaitingRoom("room-1", player)

	updatedRoom, err := ChooseStartCheckpoint(
		room,
		player.ID,
		"lysaker_cp",
	)

	if err != ErrGameNotStarted {
		t.Errorf("error = %v, want ErrGameNotStarted", err)
	}
	if updatedRoom.Players[0].Position != nil {
		t.Error("player should not get a position")
	}
}

func TestNextCheckpointIDWrapsToFirstCheckpoint(t *testing.T) {
	if len(CheckpointIDSequence) < 2 {
		t.Fatal("checkpoint sequence needs at least two checkpoints")
	}

	lastCheckpoint := CheckpointIDSequence[len(CheckpointIDSequence)-1]
	firstCheckpoint := CheckpointIDSequence[0]

	nextCheckpoint := nextCheckpointID(lastCheckpoint)

	if nextCheckpoint == nil {
		t.Fatal("next checkpoint should exist")
	}
	if *nextCheckpoint != firstCheckpoint {
		t.Errorf(
			"next checkpoint = %q, want %q",
			*nextCheckpoint,
			firstCheckpoint,
		)
	}
}

func TestEndTurnConfirmsSetupAndActivatesNextPlayer(t *testing.T) {
	room := fillRoomWithPlayers(MaxPlayers)
	firstPlayerID := *room.ActivePlayerID
	expectedNextPlayerID := room.Players[1].ID

	room, err := ChooseStartCheckpoint(
		room,
		firstPlayerID,
		"lysaker_cp",
	)
	if err != nil {
		t.Fatalf("ChooseStartCheckpoint returned an error: %v", err)
	}

	updatedRoom, err := EndTurn(room, firstPlayerID)
	if err != nil {
		t.Fatalf("EndTurn returned an error: %v", err)
	}

	if !updatedRoom.Players[0].SetupConfirmed {
		t.Error("first player should be setup-confirmed")
	}
	if updatedRoom.ActivePlayerID == nil {
		t.Fatal("room should have an active player")
	}
	if *updatedRoom.ActivePlayerID != expectedNextPlayerID {
		t.Errorf(
			"active player = %q, want %q",
			*updatedRoom.ActivePlayerID,
			expectedNextPlayerID,
		)
	}
	if updatedRoom.Phase != PhaseSetup {
		t.Errorf("phase = %q, want %q", updatedRoom.Phase, PhaseSetup)
	}
	if updatedRoom.Players[0].Position == nil {
		t.Fatal("first player should keep the chosen checkpoint")
	}
	if *updatedRoom.Players[0].Position != "lysaker_cp" {
		t.Errorf(
			"position = %q, want %q",
			*updatedRoom.Players[0].Position,
			"lysaker_cp",
		)
	}
}
