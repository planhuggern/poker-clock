package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMethodDispatch(t *testing.T) {
	handler := methodDispatch(map[string]http.HandlerFunc{
		http.MethodGet: func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		},
	})

	t.Run("known method calls handler", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		w := httptest.NewRecorder()
		handler(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
		}
	})

	t.Run("unknown method rejected", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodDelete, "/", nil)
		w := httptest.NewRecorder()
		handler(w, req)

		if w.Code != http.StatusMethodNotAllowed {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusMethodNotAllowed)
		}
	})
}
