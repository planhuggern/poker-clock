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
