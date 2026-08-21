package osloconquest

import (
	"errors"
)

var ErrNotActivePlayer = errors.New("player is not the active player")
var ErrPlayerNotFound = errors.New("player not found in room")
var ErrInvalidCheckpoint = errors.New("invalid checkpoint")
var ErrGameNotStarted = errors.New("game has not started yet")
var ErrAlreadyRolled = errors.New("player has already rolled the dice this turn")
var ErrNotPlaying = errors.New("game is not in playing phase")
var ErrNoMovesRemaining = errors.New("player has no moves remaining")
var ErrInvalidMove = errors.New("invalid move: destination is not reachable")
var ErrInvalidPhase = errors.New("invalid game phase for this action")

func isActivePlayer(room Room, playerID PlayerID) bool {
	return room.ActivePlayerID != nil && *room.ActivePlayerID == playerID
}

func isCheckpoint(nodeID MapNodeID) bool {
	return containsMapNodeID(CheckpointIDSequence, nodeID)
}

func isNextCheckpoint(player Player, nodeID MapNodeID) bool {
	if !isCheckpoint(nodeID) {
		return false
	}
	if player.NextCheckpoint == nil {
		return false
	}
	return *player.NextCheckpoint == nodeID
}

func playerByID(players []Player, playerID PlayerID) *Player {
	for i := range players {
		if players[i].ID == playerID {
			return &players[i]
		}
	}
	return nil
}

func nextCheckpointID(currentCheckpointID MapNodeID) *MapNodeID {
	for i, cp := range CheckpointIDSequence {
		if cp == currentCheckpointID {
			nextIndex := (i + 1) % len(CheckpointIDSequence)
			return &CheckpointIDSequence[nextIndex]
		}
	}
	return nil
}

func getNextActivePlayerID(room Room) *PlayerID {
	if room.ActivePlayerID == nil {
		return nil
	}

	for i, player := range room.Players {
		if room.ActivePlayerID != nil && player.ID == *room.ActivePlayerID {
			nextIndex := (i + 1) % len(room.Players)
			return &room.Players[nextIndex].ID
		}
	}
	return nil
}

func allPlayersSetupConfirmed(room Room) bool {
	for _, player := range room.Players {
		if !player.SetupConfirmed {
			return false
		}
	}
	return true
}

func ChooseStartCheckpoint(room Room, actorID PlayerID, checkpointID MapNodeID) (Room, error) {
	if room.Phase != PhaseSetup {
		return room, ErrGameNotStarted
	}

	if !isActivePlayer(room, actorID) {
		return room, ErrNotActivePlayer
	}

	room = room.Clone()
	activePlayer := playerByID(room.Players, actorID)
	if activePlayer == nil {
		return room, ErrPlayerNotFound
	}

	if !isCheckpoint(checkpointID) {
		return room, ErrInvalidCheckpoint
	}

	activePlayer.NextCheckpoint = nextCheckpointID(checkpointID)

	activePlayer.Position = &checkpointID
	return room, nil
}

func EndTurn(room Room, actorID PlayerID) (Room, error) {
	if !isActivePlayer(room, actorID) {
		return room, ErrNotActivePlayer
	}

	room = room.Clone()
	activePlayer := playerByID(room.Players, actorID)
	if activePlayer == nil {
		return room, ErrPlayerNotFound
	}

	if room.Phase == PhaseSetup {
		if activePlayer.NextCheckpoint == nil {
			return room, ErrInvalidCheckpoint
		}
		activePlayer.SetupConfirmed = true

		room.ActivePlayerID = getNextActivePlayerID(room)
		if allPlayersSetupConfirmed(room) {
			room.Phase = PhasePlaying
		}
		return room, nil
	}

	if room.Phase == PhasePlaying {
		activePlayer.DiceRoll = nil
		activePlayer.MovesRemaining = 0
		activePlayer.ValidMoves = nil

		room.ActivePlayerID = getNextActivePlayerID(room)

		return room, nil
	}

	return room, ErrInvalidPhase
}

func RollDice(room Room, actorID PlayerID, diceFunc func() int) (Room, error) {
	if !isActivePlayer(room, actorID) {
		return room, ErrNotActivePlayer
	}

	if room.Phase != PhasePlaying {
		return room, ErrNotPlaying
	}

	room = room.Clone()
	activePlayer := playerByID(room.Players, actorID)
	if activePlayer == nil {
		return room, ErrPlayerNotFound
	}

	if activePlayer.DiceRoll != nil {
		return room, ErrAlreadyRolled
	}
	roll := diceFunc()
	activePlayer.DiceRoll = &roll
	activePlayer.MovesRemaining = roll
	activePlayer.ValidMoves = reachableMapNodes(*activePlayer.Position, roll)
	return room, nil
}

// Move allows the active player to move to a new position on the map, given that they have moves remaining and the destination is valid.
func Move(room Room, actorID PlayerID, destination MapNodeID) (Room, error) {
	if !isActivePlayer(room, actorID) {
		return room, ErrNotActivePlayer
	}

	if room.Phase != PhasePlaying {
		return room, ErrNotPlaying
	}

	room = room.Clone()
	activePlayer := playerByID(room.Players, actorID)
	if activePlayer == nil {
		return room, ErrPlayerNotFound
	}

	if activePlayer.MovesRemaining <= 0 {
		return room, ErrNoMovesRemaining
	}

	valid := false
	for _, move := range activePlayer.ValidMoves {
		if move == destination {
			valid = true
			break
		}
	}
	if !valid {
		return room, ErrInvalidMove
	}

	activePlayer.Position = &destination
	if isNextCheckpoint(*activePlayer, destination) {
		activePlayer.Money += CheckpointBonusMoney
		activePlayer.Units += CheckpointBonusUnits
		activePlayer.NextCheckpoint = nextCheckpointID(destination)
	}

	activePlayer.MovesRemaining = 0
	activePlayer.ValidMoves = nil
	return room, nil
}

func Forfeit(room Room, actorID PlayerID) (Room, error) {
	room = room.Clone()
	forfeitingPlayer := playerByID(room.Players, actorID)
	if forfeitingPlayer == nil {
		return room, ErrPlayerNotFound
	}

	if forfeitingPlayer.ID == *room.ActivePlayerID {
		room.ActivePlayerID = getNextActivePlayerID(room)
	}

	if len(room.Players) <= 2 {
		room.Phase = PhaseGameOver
		room.WinnerID = room.ActivePlayerID
	}

	// Remove the forfeiting player from the room
	newPlayers := []Player{}
	for _, player := range room.Players {
		if player.ID != actorID {
			newPlayers = append(newPlayers, player)
		}
	}
	room.Players = newPlayers

	return room, nil
}
