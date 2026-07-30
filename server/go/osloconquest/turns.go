package osloconquest

import (
	"errors"
	"slices"
)

var ErrNotActivePlayer = errors.New("player is not the active player")
var ErrPlayerNotFound = errors.New("player not found in room")
var ErrInvalidCheckpoint = errors.New("invalid checkpoint")
var ErrGameNotStarted = errors.New("game has not started yet")

func isActivePlayer(room Room, playerID PlayerID) bool {
	return room.ActivePlayerID != nil && *room.ActivePlayerID == playerID
}

func isCheckpoint(nodeID MapNodeID) bool {
	return containsMapNodeID(CheckpointIDSequence, nodeID)
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

	var currentIndex int = -1
	for i, player := range room.Players {
		if room.ActivePlayerID != nil && player.ID == *room.ActivePlayerID {
			currentIndex = i
			break
		}
	}

	if currentIndex == -1 {
		return nil
	}

	nextIndex := (currentIndex + 1) % len(room.Players)
	return &room.Players[nextIndex].ID
}

func ChooseStartCheckpoint(room Room, actorID PlayerID, checkpointID MapNodeID) (Room, error) {
	if room.Phase != PhaseSetup {
		return room, ErrGameNotStarted
	}

	if !isActivePlayer(room, actorID) {
		return room, ErrNotActivePlayer
	}

	room.Players = slices.Clone(room.Players)
	var activePlayer *Player
	for i := range room.Players {
		if room.Players[i].ID == actorID {
			activePlayer = &room.Players[i]
		}
	}

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

	room.Players = slices.Clone(room.Players)
	var activePlayer *Player
	for i := range room.Players {
		if room.Players[i].ID == actorID {
			activePlayer = &room.Players[i]
		}
	}

	if activePlayer == nil {
		return room, ErrPlayerNotFound
	}

	if activePlayer.NextCheckpoint == nil {
		return room, ErrInvalidCheckpoint
	}

	activePlayer.SetupConfirmed = true

	room.ActivePlayerID = getNextActivePlayerID(room)
	return room, nil
}