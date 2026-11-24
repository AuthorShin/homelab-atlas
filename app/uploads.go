package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

const (
	uploadWriteHeader = "X-Atlas-Upload"
	uploadDirectory   = "uploads"
	maxUploadBytes    = 2_000_000
)

var (
	uploadNamePattern    = regexp.MustCompile(`^[0-9a-f]{64}\.(png|jpg|webp|svg|ico)$`)
	svgEventAttribute    = regexp.MustCompile(`(?i)\son[a-z]+\s*=`)
	svgExternalReference = regexp.MustCompile(`(?i)(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|//|data:)`)
	svgExternalURL       = regexp.MustCompile(`(?i)url\(\s*["']?\s*(?:https?:|//|data:)`)
)

var uploadContentTypes = map[string]string{
	".png":  "image/png",
	".jpg":  "image/jpeg",
	".webp": "image/webp",
	".svg":  "image/svg+xml",
	".ico":  "image/x-icon",
}

type uploadStore struct {
	directory string
}

// newUploadStore keeps uploaded images in ATLAS_DATA_DIR/uploads. Like the
// other optional stores, it stays unavailable instead of failing startup.
func newUploadStore(dataDirectory string) *uploadStore {
	store := &uploadStore{}
	if dataDirectory == "" {
		log.Print("Image uploads are disabled because ATLAS_DATA_DIR is empty")
		return store
	}
	directory := filepath.Join(dataDirectory, uploadDirectory)
	if err := os.MkdirAll(directory, 0o755); err != nil {
		log.Printf("Image uploads are unavailable: %v", err)
		return store
	}
	probe, err := os.CreateTemp(directory, ".atlas-upload-*")
	if err != nil {
		log.Printf("Image uploads are unavailable: %v", err)
		return store
	}
	probeName := probe.Name()
	if err := probe.Close(); err != nil {
		_ = os.Remove(probeName)
		log.Printf("Image uploads are unavailable: %v", err)
		return store
	}
	if err := os.Remove(probeName); err != nil {
		log.Printf("Image uploads are unavailable: %v", err)
		return store
	}
	store.directory = directory
	return store
}

func (store *uploadStore) available() bool {
	return store != nil && store.directory != ""
}

func isUploadReference(value string) bool {
	const prefix = "/api/uploads/"
	return strings.HasPrefix(value, prefix) && uploadNamePattern.MatchString(strings.TrimPrefix(value, prefix))
}

func (store *uploadStore) put(name string, data []byte) error {
	if !store.available() {
		return errStoreUnavailable
	}
	target := filepath.Join(store.directory, name)
	if _, err := os.Stat(target); err == nil {
		return nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	temporary, err := os.CreateTemp(store.directory, ".upload-*")
	if err != nil {
		return err
	}
	temporaryName := temporary.Name()
	cleanup := func() {
		_ = temporary.Close()
		_ = os.Remove(temporaryName)
	}
	if err := temporary.Chmod(0o644); err != nil {
		cleanup()
		return err
	}
	if _, err := temporary.Write(data); err != nil {
		cleanup()
		return err
	}
	if err := temporary.Sync(); err != nil {
		cleanup()
		return err
	}
	if err := temporary.Close(); err != nil {
		_ = os.Remove(temporaryName)
		return err
	}
	if err := os.Rename(temporaryName, target); err != nil {
		_ = os.Remove(temporaryName)
		return err
	}
	return nil
}

func (server *atlasServer) serveUploads(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("X-Content-Type-Options", "nosniff")
	if request.URL.Path == "/api/uploads" {
		if request.Method != http.MethodPost {
			methodNotAllowed(writer, "POST")
			return
		}
		server.createUpload(writer, request)
		return
	}
	name := strings.TrimPrefix(request.URL.Path, "/api/uploads/")
	if name == "" || strings.Contains(name, "/") || !uploadNamePattern.MatchString(name) {
		http.NotFound(writer, request)
		return
	}
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		methodNotAllowed(writer, "GET, HEAD")
		return
	}
	server.serveUploadFile(writer, request, name)
}

func (server *atlasServer) createUpload(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	if request.Header.Get(uploadWriteHeader) != "1" {
		writeAPIError(writer, request, http.StatusForbidden, "image uploads require the Atlas request header")
		return
	}
	mediaType, _, err := mime.ParseMediaType(request.Header.Get("Content-Type"))
	if err != nil {
		writeAPIError(writer, request, http.StatusUnsupportedMediaType, "image uploads must use an image content type")
		return
	}
	mediaType = strings.ToLower(mediaType)
	extension, ok := map[string]string{
		"image/png":     ".png",
		"image/jpeg":    ".jpg",
		"image/webp":    ".webp",
		"image/svg+xml": ".svg",
		"image/x-icon":  ".ico",
	}[mediaType]
	if !ok {
		writeAPIError(writer, request, http.StatusUnsupportedMediaType, "image uploads must be PNG, JPG, WebP, SVG, or ICO")
		return
	}
	if !server.uploads.available() {
		writeAPIError(writer, request, http.StatusServiceUnavailable, errStoreUnavailable.Error())
		return
	}
	request.Body = http.MaxBytesReader(writer, request.Body, maxUploadBytes+1)
	data, err := io.ReadAll(request.Body)
	if err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) || len(data) > maxUploadBytes {
			writeAPIError(writer, request, http.StatusRequestEntityTooLarge, "image uploads are limited to 2 MB")
			return
		}
		writeAPIError(writer, request, http.StatusBadRequest, "image upload could not be read")
		return
	}
	if len(data) == 0 {
		writeAPIError(writer, request, http.StatusBadRequest, "image upload is empty")
		return
	}
	if len(data) > maxUploadBytes {
		writeAPIError(writer, request, http.StatusRequestEntityTooLarge, "image uploads are limited to 2 MB")
		return
	}
	if err := validateUploadedImage(mediaType, data); err != nil {
		writeAPIError(writer, request, http.StatusBadRequest, err.Error())
		return
	}
	digest := sha256.Sum256(data)
	name := hex.EncodeToString(digest[:]) + extension
	if err := server.uploads.put(name, data); err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, errStoreUnavailable) {
			status = http.StatusServiceUnavailable
		}
		writeAPIError(writer, request, status, err.Error())
		return
	}
	encoded, err := json.Marshal(struct {
		URL   string `json:"url"`
		Type  string `json:"type"`
		Bytes int    `json:"bytes"`
	}{URL: "/api/uploads/" + name, Type: mediaType, Bytes: len(data)})
	if err != nil {
		writeAPIError(writer, request, http.StatusInternalServerError, "image upload could not be encoded")
		return
	}
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.Header().Set("Content-Length", strconv.Itoa(len(encoded)))
	writer.WriteHeader(http.StatusCreated)
	_, _ = writer.Write(encoded)
}

func (server *atlasServer) serveUploadFile(writer http.ResponseWriter, request *http.Request, name string) {
	if !server.uploads.available() {
		writeAPIError(writer, request, http.StatusServiceUnavailable, errStoreUnavailable.Error())
		return
	}
	fullPath := filepath.Join(server.uploads.directory, name)
	file, err := os.Open(fullPath)
	if errors.Is(err, os.ErrNotExist) {
		http.NotFound(writer, request)
		return
	}
	if err != nil {
		writeAPIError(writer, request, http.StatusInternalServerError, "uploaded image could not be read")
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil || info.IsDir() {
		http.NotFound(writer, request)
		return
	}
	writer.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	writer.Header().Set("Content-Disposition", "inline")
	writer.Header().Set("Content-Type", uploadContentTypes[filepath.Ext(name)])
	writer.Header().Set("ETag", `"`+strings.TrimSuffix(name, filepath.Ext(name))+`"`)
	http.ServeContent(writer, request, name, info.ModTime(), file)
}

func validateUploadedImage(mediaType string, data []byte) error {
	switch mediaType {
	case "image/png":
		if len(data) < 8 || !bytes.Equal(data[:8], []byte{137, 80, 78, 71, 13, 10, 26, 10}) {
			return errors.New("uploaded PNG is not valid")
		}
	case "image/jpeg":
		if len(data) < 3 || data[0] != 0xff || data[1] != 0xd8 || data[2] != 0xff {
			return errors.New("uploaded JPG is not valid")
		}
	case "image/webp":
		if len(data) < 12 || string(data[:4]) != "RIFF" || string(data[8:12]) != "WEBP" {
			return errors.New("uploaded WebP is not valid")
		}
	case "image/x-icon":
		if len(data) < 4 || !bytes.Equal(data[:4], []byte{0, 0, 1, 0}) {
			return errors.New("uploaded ICO is not valid")
		}
	case "image/svg+xml":
		return validateUploadedSVG(data)
	}
	return nil
}

func validateUploadedSVG(data []byte) error {
	text := string(data)
	lower := strings.ToLower(text)
	if !strings.Contains(lower, "<svg") {
		return errors.New("uploaded SVG is not valid")
	}
	for _, forbidden := range []string{"<!doctype", "<!entity", "<script", "<foreignobject", "<?xml-stylesheet", "@import"} {
		if strings.Contains(lower, forbidden) {
			return errors.New("uploaded SVG contains unsupported or unsafe content")
		}
	}
	if svgEventAttribute.MatchString(text) || svgExternalReference.MatchString(text) || svgExternalURL.MatchString(text) {
		return errors.New("uploaded SVG contains unsupported or unsafe content")
	}
	return nil
}
