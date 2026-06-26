package main

import (
	"fmt"
	"net/http"

	_ "modernc.org/sqlite"
)

func methodDispatch(handlers map[string]http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		h, ok := handlers[r.Method]
		if !ok {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		h(w, r)
	}
}

func main() {
	fmt.Println("Starting server on :8082")

	cfg, err := loadConfig("../config.json")
	if err != nil {
		fmt.Println("Config-feil:", err)
		return
	}

	dbPath := "../" + cfg.SqliteFile

	db, err := openDatabase(dbPath)
	if err != nil {
		fmt.Println("Error opening database:", err)
		return
	}
	defer db.Close()

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		fmt.Fprintln(w, "ok")
	})

	tournamentPath := "/api/tournaments"
	http.HandleFunc(
		tournamentPath,
		requireAuth(cfg.JwtSecret, methodDispatch(map[string]http.HandlerFunc{
			http.MethodGet:  listTournaments(db),
			http.MethodPost: createTournament(db),
		})),
	)
	http.HandleFunc(
		tournamentPath+"/",
		requireAuth(cfg.JwtSecret, getTournamentByID(db, tournamentPath+"/")),
	)

	fmt.Println("Lytter på :8082")

	if err := http.ListenAndServe(":8082", nil); err != nil {
		fmt.Println("Server-feil:", err)
	}
}
