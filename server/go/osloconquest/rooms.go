package osloconquest

func NewWaitingRoom(id string, player Player) Room {
	return Room{
		ID:          id,
		Players:     []Player{player},
		Territories: make(map[MapNodeID]MapNode),
		Phase:       PhaseWaiting,
		Log: []LogEntry{
			{Message: "Venter på spiller 2", Type: "info"},
		},
	}
}
