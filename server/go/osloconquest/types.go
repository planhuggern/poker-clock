package osloconquest

import (
	"maps"
	"slices"
)

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

func (player Player) Clone() Player {
	clonedPlayer := player
	if player.Position != nil {
		position := *player.Position
		clonedPlayer.Position = &position
	}
	if player.DiceRoll != nil {
		diceRoll := *player.DiceRoll
		clonedPlayer.DiceRoll = &diceRoll
	}
	if player.NextCheckpoint != nil {
		nextCheckpoint := *player.NextCheckpoint
		clonedPlayer.NextCheckpoint = &nextCheckpoint
	}
	if player.ValidMoves != nil {
		clonedPlayer.ValidMoves = slices.Clone(player.ValidMoves)
	}
	return clonedPlayer
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
	ID             string
	Players        []Player
	Territories    map[MapNodeID]MapNode
	Phase          Phase
	Started        bool
	ActivePlayerID *PlayerID
	WinnerID       *PlayerID
	Log            []LogEntry
}

func (room Room) Clone() Room {
	room.Players = slices.Clone(room.Players)
	room.Territories = maps.Clone(room.Territories)
	room.Log = slices.Clone(room.Log)
	return room
}

type RoomInfo struct {
	Room        string
	PlayerCount int
	MaxPlayers  int
	Started     bool
	Phase       Phase
	Status      string
	OwnerID     PlayerID
	PlayerIDs   []PlayerID
	Players     []string
}
