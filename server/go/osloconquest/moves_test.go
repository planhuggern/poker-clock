package osloconquest

import (
	"testing"
)


func TestNoValidMovesIfNoStartNode(t *testing.T) {
	start := MapNodeID("") // No start node
	maxSteps := 3
	reachable := reachableMapNodes(start, maxSteps)
	if len(reachable) != 0 {
		t.Errorf("expected no reachable nodes, got %v", reachable)
	}
}

func TestNoValidMovesIfMaxStepsZero(t *testing.T) {
	start := MapNodeID("A")
	maxSteps := 0
	reachable := reachableMapNodes(start, maxSteps)
	if len(reachable) != 0 {
		t.Errorf("expected no reachable nodes, got %v", reachable)
	}
}