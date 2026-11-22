package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

func sampleDefaultProject(t *testing.T) []byte {
	t.Helper()
	data, err := json.Marshal(map[string]any{
		"schemaVersion": 8,
		"title":         "Shared lab",
		"devices":       []any{},
		"networks":      []any{},
	})
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func TestDefaultProjectStoreRoundTrip(t *testing.T) {
	store := newDefaultProjectStore(t.TempDir())
	if _, found, err := store.get(); err != nil || found {
		t.Fatalf("empty store: found=%t err=%v", found, err)
	}
	project := sampleDefaultProject(t)
	if err := store.put(project); err != nil {
		t.Fatal(err)
	}
	got, found, err := store.get()
	if err != nil || !found || !bytes.Equal(got, project) {
		t.Fatalf("stored project: found=%t err=%v match=%t", found, err, bytes.Equal(got, project))
	}
	if err := store.delete(); err != nil {
		t.Fatal(err)
	}
	if _, found, err := store.get(); err != nil || found {
		t.Fatalf("deleted store: found=%t err=%v", found, err)
	}
	if err := store.delete(); err != nil {
		t.Fatalf("second delete should be idempotent: %v", err)
	}
}

func TestDefaultProjectAPI(t *testing.T) {
	server := testAtlasServer(t)
	project := sampleDefaultProject(t)

	response := request(server, http.MethodGet, "/api/default-project", nil, nil)
	if response.Code != http.StatusNotFound {
		t.Fatalf("empty GET status %d", response.Code)
	}
	response = request(server, http.MethodHead, "/api/default-project", nil, nil)
	if response.Code != http.StatusNotFound || response.Body.Len() != 0 {
		t.Fatalf("empty HEAD status=%d body=%d", response.Code, response.Body.Len())
	}

	response = request(server, http.MethodPut, "/api/default-project", project, map[string]string{"Content-Type": "application/json"})
	if response.Code != http.StatusForbidden {
		t.Fatalf("PUT without header status %d", response.Code)
	}
	response = request(server, http.MethodPut, "/api/default-project", project, map[string]string{
		"Content-Type": "text/plain", defaultProjectWriteHeader: "1",
	})
	if response.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("PUT with wrong content type status %d", response.Code)
	}
	response = request(server, http.MethodPut, "/api/default-project", []byte(`{"schemaVersion":8}`), map[string]string{
		"Content-Type": "application/json", defaultProjectWriteHeader: "1",
	})
	if response.Code != http.StatusBadRequest {
		t.Fatalf("PUT with invalid project status %d", response.Code)
	}

	response = request(server, http.MethodPut, "/api/default-project", project, map[string]string{
		"Content-Type": "application/json", defaultProjectWriteHeader: "1",
	})
	if response.Code != http.StatusNoContent {
		t.Fatalf("valid PUT status %d: %s", response.Code, response.Body.String())
	}
	response = request(server, http.MethodGet, "/api/default-project", nil, nil)
	if response.Code != http.StatusOK || !bytes.Equal(response.Body.Bytes(), project) || response.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("GET stored project: status=%d match=%t cache=%q", response.Code, bytes.Equal(response.Body.Bytes(), project), response.Header().Get("Cache-Control"))
	}
	response = request(server, http.MethodHead, "/api/default-project", nil, nil)
	if response.Code != http.StatusOK || response.Body.Len() != 0 {
		t.Fatalf("HEAD stored project: status=%d body=%d", response.Code, response.Body.Len())
	}

	response = request(server, http.MethodDelete, "/api/default-project", nil, map[string]string{defaultProjectWriteHeader: "1"})
	if response.Code != http.StatusNoContent {
		t.Fatalf("DELETE status %d", response.Code)
	}
	response = request(server, http.MethodGet, "/api/default-project", nil, nil)
	if response.Code != http.StatusNotFound {
		t.Fatalf("GET after DELETE status %d", response.Code)
	}
}

func TestDefaultProjectAPILimitsAndRoutes(t *testing.T) {
	server := testAtlasServer(t)
	if response := request(server, http.MethodPost, "/api/default-project", nil, nil); response.Code != http.StatusMethodNotAllowed || response.Header().Get("Allow") != "GET, HEAD, PUT, DELETE" {
		t.Fatalf("POST status=%d allow=%q", response.Code, response.Header().Get("Allow"))
	}
	if response := request(server, http.MethodGet, "/api/default-project/", nil, nil); response.Code != http.StatusNotFound {
		t.Fatalf("trailing slash status %d", response.Code)
	}

	oversized := append(sampleDefaultProject(t), bytes.Repeat([]byte(" "), maxDefaultProjectBytes)...)
	response := request(server, http.MethodPut, "/api/default-project", oversized, map[string]string{
		"Content-Type": "application/json", defaultProjectWriteHeader: "1",
	})
	if response.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("oversized PUT status %d", response.Code)
	}
}

func TestDefaultProjectUnavailableStore(t *testing.T) {
	server := testAtlasServer(t)
	server.defaults = &defaultProjectStore{}
	response := request(server, http.MethodGet, "/api/default-project", nil, nil)
	if response.Code != http.StatusServiceUnavailable || !strings.Contains(response.Body.String(), "unavailable") {
		t.Fatalf("GET status=%d body=%q", response.Code, response.Body.String())
	}
}
