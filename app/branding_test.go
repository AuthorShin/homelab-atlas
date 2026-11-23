package main

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"testing"
)

const testBrandingPNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

func generatedBrandingPNG(t *testing.T, width, height uint32) string {
	t.Helper()
	chunk := func(chunkType string, data []byte) []byte {
		bytes := make([]byte, 12+len(data))
		binary.BigEndian.PutUint32(bytes, uint32(len(data)))
		copy(bytes[4:8], chunkType)
		copy(bytes[8:], data)
		return bytes
	}
	header := make([]byte, 13)
	binary.BigEndian.PutUint32(header, width)
	binary.BigEndian.PutUint32(header[4:], height)
	header[8] = 8
	header[9] = 6
	parts := [][]byte{
		{137, 80, 78, 71, 13, 10, 26, 10},
		chunk("IHDR", header),
		chunk("IDAT", []byte{1}),
		chunk("IEND", nil),
	}
	var data []byte
	for _, part := range parts {
		data = append(data, part...)
	}
	return brandFaviconPrefix + base64.StdEncoding.EncodeToString(data)
}

func brandingJSON(t *testing.T, settings brandingSettings) []byte {
	t.Helper()
	data, err := json.Marshal(settings)
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func TestBrandingAPI(t *testing.T) {
	server := testAtlasServer(t)
	settings := brandingSettings{Name: "Acme Lab", TabTitle: "Acme Atlas", Favicon: testBrandingPNG}
	body := brandingJSON(t, settings)

	response := request(server, http.MethodGet, "/api/branding", nil, nil)
	if response.Code != http.StatusNotFound {
		t.Fatalf("empty GET status %d", response.Code)
	}
	response = request(server, http.MethodHead, "/api/branding", nil, nil)
	if response.Code != http.StatusNotFound || response.Body.Len() != 0 {
		t.Fatalf("empty HEAD status=%d body=%d", response.Code, response.Body.Len())
	}

	response = request(server, http.MethodPut, "/api/branding", body, map[string]string{"Content-Type": "application/json"})
	if response.Code != http.StatusForbidden {
		t.Fatalf("PUT without header status %d", response.Code)
	}
	response = request(server, http.MethodPut, "/api/branding", body, map[string]string{
		"Content-Type": "text/plain", brandingWriteHeader: "1",
	})
	if response.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("PUT with wrong content type status %d", response.Code)
	}
	response = request(server, http.MethodPut, "/api/branding", []byte(`{"name":"Acme","favicon":"https://example.test/logo.png"}`), map[string]string{
		"Content-Type": "application/json", brandingWriteHeader: "1",
	})
	if response.Code != http.StatusBadRequest {
		t.Fatalf("PUT with invalid favicon status %d", response.Code)
	}

	response = request(server, http.MethodPut, "/api/branding", body, map[string]string{
		"Content-Type": "application/json", brandingWriteHeader: "1",
	})
	if response.Code != http.StatusNoContent {
		t.Fatalf("valid PUT status %d: %s", response.Code, response.Body.String())
	}
	response = request(server, http.MethodGet, "/api/branding", nil, nil)
	if response.Code != http.StatusOK || response.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("GET branding: status=%d cache=%q", response.Code, response.Header().Get("Cache-Control"))
	}
	stored, err := parseBranding(response.Body.Bytes())
	if err != nil || stored != settings {
		t.Fatalf("GET branding: err=%v got=%+v want=%+v", err, stored, settings)
	}
	response = request(server, http.MethodHead, "/api/branding", nil, nil)
	if response.Code != http.StatusOK || response.Body.Len() != 0 {
		t.Fatalf("HEAD branding: status=%d body=%d", response.Code, response.Body.Len())
	}

	response = request(server, http.MethodDelete, "/api/branding", nil, map[string]string{brandingWriteHeader: "1"})
	if response.Code != http.StatusNoContent {
		t.Fatalf("DELETE status %d", response.Code)
	}
	response = request(server, http.MethodGet, "/api/branding", nil, nil)
	if response.Code != http.StatusNotFound {
		t.Fatalf("GET after DELETE status %d", response.Code)
	}
}

func TestBrandingValidation(t *testing.T) {
	valid := brandingSettings{Name: "Homelab Atlas"}
	if got, err := validateBranding(valid); err != nil || got.Name != "Homelab Atlas" || got.TabTitle != "" || got.Favicon != "" {
		t.Fatalf("valid branding: got=%+v err=%v", got, err)
	}
	if got, err := validateBranding(brandingSettings{Name: "  Acme  ", TabTitle: "  Tab  "}); err != nil || got.Name != "Acme" || got.TabTitle != "Tab" {
		t.Fatalf("trimmed branding: got=%+v err=%v", got, err)
	}
	for _, item := range []struct {
		name     string
		settings brandingSettings
	}{
		{"blank name", brandingSettings{Name: "   "}},
		{"long name", brandingSettings{Name: strings.Repeat("a", maxBrandNameRunes+1)}},
		{"long tab title", brandingSettings{Name: "Acme", TabTitle: strings.Repeat("a", maxBrandTabTitleRunes+1)}},
		{"control in name", brandingSettings{Name: "Acme\nLab"}},
		{"control in tab title", brandingSettings{Name: "Acme", TabTitle: "Tab\tName"}},
		{"remote favicon", brandingSettings{Name: "Acme", Favicon: "https://example.test/logo.png"}},
		{"svg favicon", brandingSettings{Name: "Acme", Favicon: "data:image/svg+xml;base64,PHN2Zz4="}},
		{"oversized favicon", brandingSettings{Name: "Acme", Favicon: brandFaviconPrefix + strings.Repeat("A", maxBrandFaviconChars)}},
		{"oversized dimensions", brandingSettings{Name: "Acme", Favicon: generatedBrandingPNG(t, 129, 1)}},
		{"empty dimensions", brandingSettings{Name: "Acme", Favicon: generatedBrandingPNG(t, 0, 1)}},
	} {
		t.Run(item.name, func(t *testing.T) {
			if _, err := validateBranding(item.settings); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
	if _, err := validateBranding(brandingSettings{Name: "Acme", Favicon: generatedBrandingPNG(t, 128, 128)}); err != nil {
		t.Fatalf("128px logo rejected: %v", err)
	}
}

func TestBrandingJSONValidation(t *testing.T) {
	for _, item := range []struct {
		name string
		body string
	}{
		{"empty", ""},
		{"null", "null"},
		{"array", "[]"},
		{"unknown key", `{"name":"Acme","tabTitle":"","favicon":"","theme":"dark"}`},
		{"missing fields", `{"name":"Acme"}`},
		{"trailing object", `{"name":"Acme","tabTitle":"","favicon":{}}`},
		{"two objects", `{"name":"Acme","tabTitle":"","favicon":""}{}`},
	} {
		t.Run(item.name, func(t *testing.T) {
			if _, err := parseBranding([]byte(item.body)); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}

func TestBrandingAPILimitsAndRoutes(t *testing.T) {
	server := testAtlasServer(t)
	if response := request(server, http.MethodPost, "/api/branding", nil, nil); response.Code != http.StatusMethodNotAllowed || response.Header().Get("Allow") != "GET, HEAD, PUT, DELETE" {
		t.Fatalf("POST status=%d allow=%q", response.Code, response.Header().Get("Allow"))
	}
	if response := request(server, http.MethodGet, "/api/branding/", nil, nil); response.Code != http.StatusNotFound {
		t.Fatalf("trailing slash status %d", response.Code)
	}

	oversized := append(brandingJSON(t, brandingSettings{Name: "Acme"}), bytes.Repeat([]byte(" "), maxBrandingBytes)...)
	response := request(server, http.MethodPut, "/api/branding", oversized, map[string]string{
		"Content-Type": "application/json", brandingWriteHeader: "1",
	})
	if response.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("oversized PUT status %d", response.Code)
	}
}

func TestBrandingStorageUnavailable(t *testing.T) {
	server := testAtlasServer(t)
	server.branding = newBrandingStore("")
	if response := request(server, http.MethodGet, "/api/branding", nil, nil); response.Code != http.StatusServiceUnavailable {
		t.Fatalf("unavailable GET status %d", response.Code)
	}
	response := request(server, http.MethodPut, "/api/branding", brandingJSON(t, brandingSettings{Name: "Acme"}), map[string]string{
		"Content-Type": "application/json", brandingWriteHeader: "1",
	})
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("unavailable PUT status %d", response.Code)
	}
}

func TestBrandingCorruptFile(t *testing.T) {
	server := testAtlasServer(t)
	if err := os.WriteFile(server.branding.path, []byte(`{"name":`), 0o600); err != nil {
		t.Fatal(err)
	}
	if response := request(server, http.MethodGet, "/api/branding", nil, nil); response.Code != http.StatusInternalServerError {
		t.Fatalf("corrupt GET status %d", response.Code)
	}
}
