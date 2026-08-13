package osloconquest

import (
	"slices"
)

func reachableMapNodes(start MapNodeID, maxSteps int) []MapNodeID {
	queue := []MapNodeID{start}
	distances := make(map[MapNodeID]int)
	distances[start] = 0
	head := 0

	for head < len(queue) {
		current := queue[head]
		head++
		if distances[current] == maxSteps {
			continue
		}

		nextDistance := distances[current] + 1
		for _, neighbor := range Adjacency[current] {
			if _, ok := distances[neighbor]; !ok {
				queue = append(queue, neighbor)
				distances[neighbor] = nextDistance
			}
		}
	}

	var result []MapNodeID
	delete(distances, start) // Delete the start node from the result
	for node := range distances {
		result = append(result, node)
	}
	// Sort the result for consistency
	slices.Sort(result)
	return result
}
