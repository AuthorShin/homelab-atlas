package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func testUploadPNG(t *testing.T) []byte {
	t.Helper()
	data, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(testBrandingPNG, brandFaviconPrefix))
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func TestUploadAPI(t *testing.T) {
	server := testAtlasServer(t)
	png := testUploadPNG(t)

	request := httptest.NewRequest(http.MethodPost, "/api/uploads", bytes.NewReader(png))
	request.Header.Set("Content-Type", "image/png")
	response := httptest.NewRecorder()
	server.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden {
		t.Fatalf("missing header: got %d", response.Code)
	}

	request = httptest.NewRequest(http.MethodPost, "/api/uploads", bytes.NewReader(png))
	request.Header.Set("Content-Type", "image/png")
	request.Header.Set(uploadWriteHeader, "1")
	response = httptest.NewRecorder()
	server.ServeHTTP(response, request)
	if response.Code != http.StatusCreated {
		t.Fatalf("upload: got %d: %s", response.Code, response.Body.String())
	}
	var payload struct {
		URL   string `json:"url"`
		Type  string `json:"type"`
		Bytes int    `json:"bytes"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256(png)
	expected := "/api/uploads/" + hex.EncodeToString(digest[:]) + ".png"
	if payload.URL != expected || payload.Type != "image/png" || payload.Bytes != len(png) {
		t.Fatalf("unexpected upload payload: %+v", payload)
	}
	if !isUploadReference(payload.URL) {
		t.Fatalf("upload URL is not recognized: %s", payload.URL)
	}

	for _, method := range []string{http.MethodGet, http.MethodHead} {
		request = httptest.NewRequest(method, payload.URL, nil)
		response = httptest.NewRecorder()
		server.ServeHTTP(response, request)
		if response.Code != http.StatusOK {
			t.Fatalf("%s upload: got %d", method, response.Code)
		}
		if !strings.Contains(response.Header().Get("Cache-Control"), "immutable") {
			t.Fatalf("upload is not cached immutably: %q", response.Header().Get("Cache-Control"))
		}
		if method == http.MethodGet && !bytes.Equal(response.Body.Bytes(), png) {
			t.Fatal("uploaded bytes changed")
		}
	}
}

func TestUploadRejectsBadInput(t *testing.T) {
	server := testAtlasServer(t)
	for _, item := range []struct {
		name        string
		contentType string
		body        string
		status      int
	}{
		{"wrong type", "text/plain", "hello", http.StatusUnsupportedMediaType},
		{"empty", "image/png", "", http.StatusBadRequest},
		{"not png", "image/png", "hello", http.StatusBadRequest},
		{"unsafe svg", "image/svg+xml", `<svg onload="alert(1)"></svg>`, http.StatusBadRequest},
		{"remote svg", "image/svg+xml", `<svg><image href="https://example.test/a.png"/></svg>`, http.StatusBadRequest},
	} {
		t.Run(item.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, "/api/uploads", strings.NewReader(item.body))
			request.Header.Set("Content-Type", item.contentType)
			request.Header.Set(uploadWriteHeader, "1")
			response := httptest.NewRecorder()
			server.ServeHTTP(response, request)
			if response.Code != item.status {
				t.Fatalf("got %d: %s", response.Code, response.Body.String())
			}
		})
	}
	for _, path := range []string{"/api/uploads/", "/api/uploads/not-a-hash.png", "/api/uploads/" + strings.Repeat("a", 64) + ".png/../bad"} {
		request := httptest.NewRequest(http.MethodGet, path, nil)
		response := httptest.NewRecorder()
		server.ServeHTTP(response, request)
		if response.Code != http.StatusNotFound {
			t.Fatalf("%s: got %d", path, response.Code)
		}
	}
}

func TestBrandingFaviconAcceptsUploadReference(t *testing.T) {
	valid := "/api/uploads/" + strings.Repeat("a", 64) + ".png"
	if err := validateBrandingFavicon(valid); err != nil {
		t.Fatalf("valid upload reference rejected: %v", err)
	}
	if err := validateBrandingFavicon(strings.TrimSuffix(valid, ".png") + ".svg"); err == nil {
		t.Fatal("SVG upload reference was accepted as an app logo")
	}
	if err := validateBrandingFavicon("/api/uploads/nope.png"); err == nil {
		t.Fatal("malformed upload reference was accepted")
	}
}
