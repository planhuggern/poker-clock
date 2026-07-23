package main

import (
	"holtebu-server/db"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	_ "modernc.org/sqlite"
)

// newTestDB opens a real, on-disk SQLite database with the clock_tournament
// schema (mirrors clock/models.py Tournament). Real DB, no mocking, per
// AGENTS.md testing conventions.
func newTestDB(t *testing.T) *sql.DB {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "test.sqlite")
	db, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("openDatabase: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	_, err = db.Exec(`
		CREATE TABLE clock_tournament (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name VARCHAR(255) NOT NULL,
			status VARCHAR(20) NOT NULL,
			state_json TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			host_id INTEGER NULL
		)
	`)
	if err != nil {
		t.Fatalf("create clock_tournament table: %v", err)
	}

	return db
}

// mustInsertTournament inserts a tournament into the test DB and returns its ID.
func mustInsertTournament(t *testing.T, db *sql.DB, name, status string) int64 {
	t.Helper()

	res, err := db.Exec(
		`INSERT INTO clock_tournament (name, status, state_json, created_at, updated_at, host_id)
		 VALUES (?, ?, '{}', '2026-01-01 00:00:00', '2026-01-01 00:00:00', NULL)`,
		name, status,
	)
	if err != nil {
		t.Fatalf("insert tournament: %v", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("LastInsertId: %v", err)
	}
	return id
}

func TestListTournaments(t *testing.T) {
	db := newTestDB(t)
	handler := listTournaments(db)

	w := httptest.NewRecorder()
	handler(w, httptest.NewRequest(http.MethodGet, "/api/tournaments", nil))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var got []Tournament
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("expected empty list, got %d tournaments", len(got))
	}

	mustInsertTournament(t, db, "Fredagsturnering", "pending")
	mustInsertTournament(t, db, "Lørdagsturnering", "running")

	w = httptest.NewRecorder()
	handler(w, httptest.NewRequest(http.MethodGet, "/api/tournaments", nil))

	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 tournaments, got %d", len(got))
	}
	// ORDER BY id DESC in listTournaments -> most recently inserted first.
	if got[0].Name != "Lørdagsturnering" {
		t.Fatalf("expected most recent tournament first, got %q", got[0].Name)
	}
}

func TestGetTournamentByID(t *testing.T) {
	db := newTestDB(t)
	id := mustInsertTournament(t, db, "Testturnering", "pending")

	urlPath := "/api/tournaments/"
	handler := getTournamentByID(db, urlPath)

	tests := []struct {
		name       string
		idSuffix   string
		wantStatus int
	}{
		{name: "found", idSuffix: strconv.FormatInt(id, 10), wantStatus: http.StatusOK},
		{name: "not found", idSuffix: "9999", wantStatus: http.StatusNotFound},
		{name: "invalid id", idSuffix: "abc", wantStatus: http.StatusBadRequest},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, urlPath+tc.idSuffix, nil)
			w := httptest.NewRecorder()
			handler(w, req)

			if w.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d, body=%s", w.Code, tc.wantStatus, w.Body.String())
			}
		})
	}
}

func TestCreateTournament(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		claims     *Claims
		wantStatus int
	}{
		{
			name:       "valid without auth leaves host_id unset",
			body:       `{"name": "Ny turnering"}`,
			claims:     nil,
			wantStatus: http.StatusCreated,
		},
		{
			name:       "valid with auth sets host_id",
			body:       `{"name": "Ny turnering med host"}`,
			claims:     &Claims{PlayerID: "1"},
			wantStatus: http.StatusCreated,
		},
		{
			name:       "empty name rejected",
			body:       `{"name": "   "}`,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "invalid json rejected",
			body:       `{not valid json`,
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			db := newTestDB(t)

			req := httptest.NewRequest(http.MethodPost, "/api/tournaments", strings.NewReader(tc.body))
			if tc.claims != nil {
				req = req.WithContext(context.WithValue(req.Context(), claimsKey, tc.claims))
			}

			w := httptest.NewRecorder()
			createTournament(db)(w, req)

			if w.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d, body=%s", w.Code, tc.wantStatus, w.Body.String())
			}
			if tc.wantStatus != http.StatusCreated {
				return
			}

			var got Tournament
			if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if got.Status != "pending" {
				t.Fatalf("status field = %q, want pending", got.Status)
			}

			var hostID sql.NullString
			err := db.QueryRow("SELECT host_id FROM clock_tournament WHERE id = ?", got.ID).Scan(&hostID)
			if err != nil {
				t.Fatalf("query host_id: %v", err)
			}
			wantHostSet := tc.claims != nil
			if hostID.Valid != wantHostSet {
				t.Fatalf("host_id set = %v, want %v", hostID.Valid, wantHostSet)
			}
		})
	}
}
