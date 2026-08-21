package osloconquest

import (
	"testing"
)

func playingRoomWithPlayers(numPlayers int, checkpointID MapNodeID, t *testing.T) Room {
	room := fillRoomWithPlayers(numPlayers)
	for range room.Players {
		var err error
		actorID := *room.ActivePlayerID
		room, err = ChooseStartCheckpoint(
			room,
			actorID,
			checkpointID,
		)
		if err != nil {
			t.Fatalf("choosing checkpoint for %q: %v", actorID, err)
		}
		room, err = EndTurn(room, actorID)
		if err != nil {
			t.Fatalf("ending setup turn for %q: %v", actorID, err)
		}
	}
	return room
}

func takePlayingTurn(room Room, actorID PlayerID, nodeID MapNodeID, t *testing.T) Room {
	t.Helper()
	var err error
	room, err = RollDice(room, actorID, func() int {
		return 3
	})
	if err != nil {
		t.Fatalf("rolling dice for %q: %v", actorID, err)
	}
	activePlayer := playerByID(room.Players, actorID)
	activePlayer.ValidMoves = []MapNodeID{nodeID}
	room, err = Move(room, actorID, nodeID)
	if err != nil {
		t.Fatalf("moving to node for %q: %v", actorID, err)
	}
	room, err = EndTurn(room, actorID)
	if err != nil {
		t.Fatalf("ending turn for %q: %v", actorID, err)
	}
	return room
}

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
	chosenCheckpoint := CheckpointIDSequence[0]

	room, err := ChooseStartCheckpoint(
		room,
		firstPlayerID,
		chosenCheckpoint,
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
	if *updatedRoom.Players[0].Position != chosenCheckpoint {
		t.Errorf(
			"position = %q, want %q",
			*updatedRoom.Players[0].Position,
			chosenCheckpoint,
		)
	}
}

func TestEndTurnStartsPlayingAfterAllPlayersConfirmSetup(t *testing.T) {
	room := playingRoomWithPlayers(MaxPlayers, CheckpointIDSequence[0], t)
	firstPlayerID := room.Players[0].ID

	if room.Phase != PhasePlaying {
		t.Errorf("phase = %q, want %q", room.Phase, PhasePlaying)
	}
	if room.ActivePlayerID == nil {
		t.Fatal("playing room should have an active player")
	}
	if *room.ActivePlayerID != firstPlayerID {
		t.Errorf(
			"active player = %q, want %q",
			*room.ActivePlayerID,
			firstPlayerID,
		)
	}
}

func TestRollDiceUsesInjectedDiceAndRejectsSecondRoll(t *testing.T) {
	room := playingRoomWithPlayers(MaxPlayers, CheckpointIDSequence[0], t)
	actorID := *room.ActivePlayerID

	updatedRoom, err := RollDice(room, actorID, func() int {
		return 4
	})
	if err != nil {
		t.Fatalf("RollDice returned an error: %v", err)
	}

	activePlayer := playerByID(updatedRoom.Players, actorID)
	if activePlayer == nil {
		t.Fatal("active player not found")
	}
	if activePlayer.DiceRoll == nil {
		t.Fatal("active player should have a dice roll")
	}
	if *activePlayer.DiceRoll != 4 {
		t.Errorf("dice roll = %d, want 4", *activePlayer.DiceRoll)
	}
	if activePlayer.MovesRemaining != 4 {
		t.Errorf("moves remaining = %d, want 4", activePlayer.MovesRemaining)
	}
	// Attempt a second roll
	updatedRoom, err = RollDice(updatedRoom, actorID, func() int {
		return 6
	})

	if err != ErrAlreadyRolled {
		t.Errorf("error = %v, want ErrAlreadyRolled", err)
	}

	activePlayer = playerByID(updatedRoom.Players, actorID)
	if activePlayer == nil || activePlayer.DiceRoll == nil {
		t.Fatal("active player should keep the first dice roll")
	}
	if *activePlayer.DiceRoll != 4 {
		t.Errorf("dice roll = %d, want 4", *activePlayer.DiceRoll)
	}
}

func TestRollDiceRejectsSetupPhase(t *testing.T) {
	room := fillRoomWithPlayers(MaxPlayers)
	actorID := *room.ActivePlayerID

	updatedRoom, err := RollDice(room, actorID, func() int {
		return 4
	})

	if err != ErrNotPlaying {
		t.Errorf("error = %v, want ErrNotPlaying", err)
	}
	activePlayer := playerByID(updatedRoom.Players, actorID)
	if activePlayer == nil {
		t.Fatal("active player not found")
	}
	if activePlayer.DiceRoll != nil {
		t.Error("player should not get a dice roll during setup")
	}
}

func TestRollDiceSetsValidMovesFromPlayerPosition(t *testing.T) {
	room := playingRoomWithPlayers(MaxPlayers, "lørenskog_cp", t)
	actorID := *room.ActivePlayerID

	updatedRoom, err := RollDice(room, actorID, func() int {
		return 1
	})
	if err != nil {
		t.Fatalf("RollDice returned an error: %v", err)
	}

	activePlayer := playerByID(updatedRoom.Players, actorID)
	if activePlayer == nil {
		t.Fatal("active player not found")
	}

	want := []MapNodeID{"t26", "t27", "t28"}
	if len(activePlayer.ValidMoves) != len(want) {
		t.Fatalf("valid moves = %v, want %v", activePlayer.ValidMoves, want)
	}
	for i, move := range activePlayer.ValidMoves {
		if move != want[i] {
			t.Errorf("valid moves = %v, want %v", activePlayer.ValidMoves, want)
			break
		}
	}
}

func TestMoveUpdatesActivePlayerPosition(t *testing.T) {
	room := playingRoomWithPlayers(MaxPlayers, "kolbotn_cp", t)
	actorID := *room.ActivePlayerID

	room, err := RollDice(room, actorID, func() int {
		return 6
	})
	if err != nil {
		t.Fatalf("RollDice returned an error: %v", err)
	}

	updatedRoom, err := Move(room, actorID, "t35")
	if err != nil {
		t.Fatalf("Move returned an error: %v", err)
	}

	activePlayer := playerByID(updatedRoom.Players, actorID)
	if activePlayer == nil {
		t.Fatal("active player not found")
	}
	if activePlayer.Position == nil || *activePlayer.Position != "t35" {
		t.Errorf("position = %v, want %q", activePlayer.Position, "t35")
	}
	if activePlayer.MovesRemaining != 0 {
		t.Errorf("moves remaining = %d, want 0", activePlayer.MovesRemaining)
	}
	if len(activePlayer.ValidMoves) != 0 {
		t.Errorf("valid moves = %v, want empty", activePlayer.ValidMoves)
	}

	inputPlayer := playerByID(room.Players, actorID)
	if inputPlayer.Position == nil || *inputPlayer.Position != "kolbotn_cp" {
		t.Error("input room should not be mutated")
	}
}

func TestMoveGrantsCheckpointBonus(t *testing.T) {
	room := playingRoomWithPlayers(MaxPlayers, "kolbotn_cp", t)
	actorID := *room.ActivePlayerID

	// Set up the move state directly so the test checks the rule, not the
	// board layout: any destination listed in ValidMoves is accepted.
	activePlayer := playerByID(room.Players, actorID)
	activePlayer.MovesRemaining = 1
	activePlayer.ValidMoves = []MapNodeID{"lørenskog_cp"}
	nextCheckpoint := MapNodeID("lørenskog_cp")
	activePlayer.NextCheckpoint = &nextCheckpoint

	updatedRoom, err := Move(room, actorID, "lørenskog_cp")
	if err != nil {
		t.Fatalf("Move returned an error: %v", err)
	}

	movedPlayer := playerByID(updatedRoom.Players, actorID)
	if movedPlayer == nil {
		t.Fatal("active player not found")
	}
	if movedPlayer.Position == nil || *movedPlayer.Position != "lørenskog_cp" {
		t.Errorf("position = %v, want %q", movedPlayer.Position, "lørenskog_cp")
	}
	if movedPlayer.Money != CheckpointBonusMoney {
		t.Errorf(
			"money = %d, want %d",
			movedPlayer.Money,
			CheckpointBonusMoney,
		)
	}
	if movedPlayer.Units != CheckpointBonusUnits {
		t.Errorf(
			"units = %d, want %d",
			movedPlayer.Units,
			CheckpointBonusUnits,
		)
	}
	if movedPlayer.NextCheckpoint == nil {
		t.Fatal("next checkpoint should be set after bonus")
	}
	if *movedPlayer.NextCheckpoint != "lysaker_cp" {
		t.Errorf("next checkpoint = %q, want %q", *movedPlayer.NextCheckpoint, "lysaker_cp")
	}
}

func TestMoveSkipsBonusForWrongCheckpoint(t *testing.T) {
	room := playingRoomWithPlayers(MaxPlayers, "kolbotn_cp", t)
	actorID := *room.ActivePlayerID

	activePlayer := playerByID(room.Players, actorID)
	activePlayer.MovesRemaining = 1
	activePlayer.ValidMoves = []MapNodeID{"lysaker_cp"}
	nextCheckpoint := MapNodeID("lørenskog_cp")
	activePlayer.NextCheckpoint = &nextCheckpoint

	updatedRoom, err := Move(room, actorID, "lysaker_cp")
	if err != nil {
		t.Fatalf("Move returned an error: %v", err)
	}

	movedPlayer := playerByID(updatedRoom.Players, actorID)
	if movedPlayer == nil {
		t.Fatal("active player not found")
	}
	if movedPlayer.Money != 0 {
		t.Errorf("money = %d, want 0", movedPlayer.Money)
	}
	if movedPlayer.Units != 0 {
		t.Errorf("units = %d, want 0", movedPlayer.Units)
	}
	if movedPlayer.NextCheckpoint == nil || *movedPlayer.NextCheckpoint != "lørenskog_cp" {
		t.Errorf(
			"next checkpoint = %v, want %q",
			movedPlayer.NextCheckpoint,
			"lørenskog_cp",
		)
	}
}

func TestEndTurnInPlayingResetsDiceAndSwitchesPlayer(t *testing.T) {
	room := playingRoomWithPlayers(MaxPlayers, "kolbotn_cp", t)
	actorID := *room.ActivePlayerID

	var err error
	room, err = RollDice(room, actorID, func() int {
		return 3
	})
	if err != nil {
		t.Fatalf("rolling dice for %q: %v", actorID, err)
	}
	activePlayer := playerByID(room.Players, actorID)
	activePlayer.ValidMoves = []MapNodeID{"kolbotn_cp"}
	room, err = Move(room, actorID, "kolbotn_cp")
	if err != nil {
		t.Fatalf("moving to node for %q: %v", actorID, err)
	}
	room, err = EndTurn(room, actorID)
	if err != nil {
		t.Fatalf("ending turn for %q: %v", actorID, err)
	}

	activePlayer = playerByID(room.Players, actorID)
	newActivePlayerID := *room.ActivePlayerID
	if activePlayer == nil {
		t.Fatal("active player not found")
	}

	if activePlayer.DiceRoll != nil {
		t.Errorf("dice roll = %v, want nil", *activePlayer.DiceRoll)
	}
	if activePlayer.MovesRemaining != 0 {
		t.Errorf("moves remaining = %d, want 0", activePlayer.MovesRemaining)
	}
	if len(activePlayer.ValidMoves) != 0 {
		t.Errorf("valid moves = %v, want []", activePlayer.ValidMoves)
	}
	if newActivePlayerID == actorID {
		t.Error("active player should switch after ending turn")
	}
}

func TestEndTurnInPlayingWhenSkippingMovesResetsDiceAndSwitchesPlayer(t *testing.T) {
	room := playingRoomWithPlayers(MaxPlayers, "kolbotn_cp", t)
	actorID := *room.ActivePlayerID
	var err error

	room, err = RollDice(room, actorID, func() int {
		return 3
	})
	if err != nil {
		t.Fatalf("rolling dice for %q: %v", actorID, err)
	}

	room, err = EndTurn(room, actorID)
	if err != nil {
		t.Fatalf("ending turn for %q: %v", actorID, err)
	}

	activePlayer := playerByID(room.Players, actorID)
	newActivePlayerID := *room.ActivePlayerID
	if activePlayer == nil {
		t.Fatal("active player not found")
	}

	if activePlayer.DiceRoll != nil {
		t.Errorf("dice roll = %v, want nil", *activePlayer.DiceRoll)
	}
	if activePlayer.MovesRemaining != 0 {
		t.Errorf("moves remaining = %d, want 0", activePlayer.MovesRemaining)
	}
	if len(activePlayer.ValidMoves) != 0 {
		t.Errorf("valid moves = %v, want []", activePlayer.ValidMoves)
	}
	if newActivePlayerID == actorID {
		t.Error("active player should switch after ending turn")
	}
}
