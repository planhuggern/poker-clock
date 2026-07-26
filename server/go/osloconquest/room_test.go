package osloconquest

import "testing"

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