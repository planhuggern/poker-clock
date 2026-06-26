package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

type Tournament struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at,omitempty"`
}

func listTournaments(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(
			"SELECT id, name, status, created_at FROM clock_tournament ORDER BY id DESC",
		)
		if err != nil {
			http.Error(w, "DB-Feil", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var tournaments []Tournament
		for rows.Next() {
			var t Tournament
			err := rows.Scan(&t.ID, &t.Name, &t.Status, &t.CreatedAt)
			if err != nil {
				http.Error(w, "Error scanning row", http.StatusInternalServerError)
				return
			}
			tournaments = append(tournaments, t)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(tournaments)
	}
}

func getTournamentByID(db *sql.DB, urlPath string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := r.URL.Path[len(urlPath):]
		id, err := strconv.Atoi(idStr)
		if err != nil {
			http.Error(w, "Invalid tournament ID", http.StatusBadRequest)
			return
		}
		row := db.QueryRow(
			"SELECT id, name, status, created_at FROM clock_tournament WHERE id = ?",
			id,
		)
		var t Tournament
		err = row.Scan(&t.ID, &t.Name, &t.Status, &t.CreatedAt)
		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "Tournament not found", http.StatusNotFound)
			} else {
				http.Error(w, "Error querying database", http.StatusInternalServerError)
			}
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(t)
	}
}

type createTournamentBody struct {
	Name      string         `json:"name"`
	StateJSON map[string]any `json:"state_json"`
}

func createTournament(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims := claimsFromContext(r.Context())
		if claims == nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		var body createTournamentBody
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		name := strings.TrimSpace(body.Name)
		if name == "" {
			http.Error(w, "name must be a non-empty string", http.StatusBadRequest)
			return
		}

		stateJSON := body.StateJSON
		if stateJSON == nil {
			stateJSON = map[string]any{}
		}
		stateJSONBytes, err := json.Marshal(stateJSON)
		if err != nil {
			http.Error(w, "Error encoding state_json", http.StatusInternalServerError)
			return
		}

		now := time.Now().UTC().Format("2006-01-02 15:04:05.000000")

		result, err := db.Exec(
			`INSERT INTO clock_tournament (name, status, state_json, created_at, updated_at, host_id)
			 VALUES (?, 'pending', ?, ?, ?, ?)`,
			name, string(stateJSONBytes), now, now, claims.PlayerID,
		)
		if err != nil {
			http.Error(w, "DB error", http.StatusInternalServerError)
			return
		}

		id, err := result.LastInsertId()
		if err != nil {
			http.Error(w, "DB error", http.StatusInternalServerError)
			return
		}

		t := Tournament{
			ID:        int(id),
			Name:      name,
			Status:    "pending",
			CreatedAt: now,
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(t)
	}
}
