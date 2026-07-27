package osloconquest

type PlayerID string
type MapNodeID string
type Phase string

const (
	PhaseWaiting  Phase = "waiting"
	PhaseSetup    Phase = "setup"
	PhasePlaying  Phase = "playing"
	PhaseGameOver Phase = "finished"
)

const MaxPlayers = 2

type Player struct {
	ID             PlayerID
	Name           string
	Color          string
	ColorName      string
	IsBot          bool
	Position       *MapNodeID
	MovesRemaining int
	DiceRoll       *int
	ValidMoves     []MapNodeID
	SetupConfirmed bool
	Money          int
	Units          int
	NextCheckpoint *MapNodeID
}

type MapNode struct {
	ID    MapNodeID
	Owner *PlayerID
	Units int
}

type LogEntry struct {
	Message string
	Type    string
	Time    string
}

type Room struct {
	ID           string
	Players      []Player
	Territories  map[MapNodeID]MapNode
	Phase        Phase
	Started      bool
	ActivePlayer *PlayerID
	Winner       *PlayerID
	Log          []LogEntry
}
