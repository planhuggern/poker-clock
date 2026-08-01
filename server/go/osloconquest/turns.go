package osloconquest

import (
	"errors"
)

var ErrNotActivePlayer = errors.New("player is not the active player")
var ErrPlayerNotFound = errors.New("player not found in room")
var ErrInvalidCheckpoint = errors.New("invalid checkpoint")
var ErrGameNotStarted = errors.New("game has not started yet")
var ErrAlreadyRolled = errors.New("player has already rolled the dice this turn")

func isActivePlayer(room Room, playerID PlayerID) bool {
	return room.ActivePlayerID != nil && *room.ActivePlayerID == playerID
}

func isCheckpoint(nodeID MapNodeID) bool {
	return containsMapNodeID(CheckpointIDSequence, nodeID)
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

func RollDice(room Room, actorID PlayerID, diceFunc func() int) (Room, error) {
	if !isActivePlayer(room, actorID) {
		return room, ErrNotActivePlayer
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
	return room, nil
}
