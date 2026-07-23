package main

import (
	"os"
	"net"
	"fmt"
	"net/http"
	"strings"

	_ "modernc.org/sqlite"

	"holtebu-server/config"
	"holtebu-server/db"
)

func addressWithPort() string {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}

	host := os.Getenv("HOST")
	if host == "" {
		host = "127.0.0.1"
	}

	addr := net.JoinHostPort(host, port)
	return addr
}

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
	addr := addressWithPort()
	fmt.Println("Starting server on", addr)

	cfg, err := config.LoadConfig("../config.json")
	if err != nil {
		fmt.Println("Config-feil:", err)
		return
	}

	dbPath := "../" + cfg.SqliteFile

	db, err := db.Open(dbPath)
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
		methodDispatch(map[string]http.HandlerFunc{
			http.MethodGet:  listTournaments(db),
			http.MethodPost: createTournament(db),
		}),
	)
	http.HandleFunc(
		tournamentPath+"/",
		getTournamentByID(db, tournamentPath+"/"),
	)

	fmt.Println("Lytter på", addr, "...")

	// Traefik may or may not strip /pokerklokke before forwarding — handle both.
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.URL.Path = strings.TrimPrefix(r.URL.Path, "/pokerklokke")
		if r.URL.Path == "" {
			r.URL.Path = "/"
		}
		http.DefaultServeMux.ServeHTTP(w, r)
	})

	if err := http.ListenAndServe(addr, handler); err != nil {
		fmt.Println("Server-feil:", err)
	}
}
