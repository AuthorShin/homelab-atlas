package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"sync"
)

const (
	defaultProjectFilename    = "default-project.json"
	defaultProjectWriteHeader = "X-Atlas-Default"
	maxDefaultProjectBytes    = 2_000_000
)

var errDefaultProjectUnavailable = errors.New("default project storage is unavailable")

type defaultProjectStore struct {
	path string
	mu   sync.RWMutex
}

// newDefaultProjectStore returns a store backed by directory. If the directory
// cannot be created or written, the store stays unavailable and the rest of the
// app keeps working without a shared default.
func newDefaultProjectStore(directory string) *defaultProjectStore {
	store := &defaultProjectStore{}
	if directory == "" {
		log.Print("Default project storage is disabled because ATLAS_DATA_DIR is empty")
		return store
	}
	if err := os.MkdirAll(directory, 0o755); err != nil {
		log.Printf("Default project storage is unavailable: %v", err)
		return store
	}
	probe, err := os.CreateTemp(directory, ".atlas-write-*")
	if err != nil {
		log.Printf("Default project storage is unavailable: %v", err)
		return store
	}
	probeName := probe.Name()
	if err := probe.Close(); err != nil {
		_ = os.Remove(probeName)
		log.Printf("Default project storage is unavailable: %v", err)
		return store
	}
	if err := os.Remove(probeName); err != nil {
		log.Printf("Default project storage is unavailable: %v", err)
		return store
	}
	store.path = filepath.Join(directory, defaultProjectFilename)
	return store
}

func (store *defaultProjectStore) get() ([]byte, bool, error) {
	if store.path == "" {
		return nil, false, errDefaultProjectUnavailable
	}
	store.mu.RLock()
	defer store.mu.RUnlock()
	data, err := os.ReadFile(store.path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return data, true, nil
}

func (store *defaultProjectStore) put(data []byte) error {
	if store.path == "" {
		return errDefaultProjectUnavailable
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	directory := filepath.Dir(store.path)
	temporary, err := os.CreateTemp(directory, ".default-project-*")
	if err != nil {
		return err
	}
	name := temporary.Name()
	cleanup := func() {
		_ = temporary.Close()
		_ = os.Remove(name)
	}
	if err := temporary.Chmod(0o600); err != nil {
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
		_ = os.Remove(name)
		return err
	}
	if err := os.Rename(name, store.path); err != nil {
		_ = os.Remove(name)
		return err
	}
	return nil
}

func (store *defaultProjectStore) delete() error {
	if store.path == "" {
		return errDefaultProjectUnavailable
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	if err := os.Remove(store.path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

func (server *atlasServer) serveDefaultProject(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	writer.Header().Set("X-Content-Type-Options", "nosniff")

	switch request.Method {
	case http.MethodGet, http.MethodHead:
		data, found, err := server.defaults.get()
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, errDefaultProjectUnavailable) {
				status = http.StatusServiceUnavailable
			}
			writeAPIError(writer, request, status, err.Error())
			return
		}
		if !found {
			writeAPIError(writer, request, http.StatusNotFound, "no default project is saved")
			return
		}
		writer.Header().Set("Content-Type", "application/json; charset=utf-8")
		writer.Header().Set("Content-Length", strconv.Itoa(len(data)))
		writer.WriteHeader(http.StatusOK)
		if request.Method != http.MethodHead {
			_, _ = writer.Write(data)
		}
	case http.MethodPut:
		if request.Header.Get(defaultProjectWriteHeader) != "1" {
			writeAPIError(writer, request, http.StatusForbidden, "default project writes require the Atlas request header")
			return
		}
		mediaType, _, err := mime.ParseMediaType(request.Header.Get("Content-Type"))
		if err != nil || mediaType != "application/json" {
			writeAPIError(writer, request, http.StatusUnsupportedMediaType, "default project must be application/json")
			return
		}
		request.Body = http.MaxBytesReader(writer, request.Body, maxDefaultProjectBytes+1)
		data, err := io.ReadAll(request.Body)
		if err != nil {
			var tooLarge *http.MaxBytesError
			if errors.As(err, &tooLarge) || len(data) > maxDefaultProjectBytes {
				writeAPIError(writer, request, http.StatusRequestEntityTooLarge, "default project is larger than 2 MB")
				return
			}
			writeAPIError(writer, request, http.StatusBadRequest, "default project could not be read")
			return
		}
		if len(data) > maxDefaultProjectBytes {
			writeAPIError(writer, request, http.StatusRequestEntityTooLarge, "default project is larger than 2 MB")
			return
		}
		if err := validateDefaultProject(data); err != nil {
			writeAPIError(writer, request, http.StatusBadRequest, err.Error())
			return
		}
		if err := server.defaults.put(data); err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, errDefaultProjectUnavailable) {
				status = http.StatusServiceUnavailable
			}
			writeAPIError(writer, request, status, err.Error())
			return
		}
		writer.WriteHeader(http.StatusNoContent)
	case http.MethodDelete:
		if request.Header.Get(defaultProjectWriteHeader) != "1" {
			writeAPIError(writer, request, http.StatusForbidden, "default project writes require the Atlas request header")
			return
		}
		if err := server.defaults.delete(); err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, errDefaultProjectUnavailable) {
				status = http.StatusServiceUnavailable
			}
			writeAPIError(writer, request, status, err.Error())
			return
		}
		writer.WriteHeader(http.StatusNoContent)
	default:
		methodNotAllowed(writer, "GET, HEAD, PUT, DELETE")
	}
}

func validateDefaultProject(data []byte) error {
	if len(bytes.TrimSpace(data)) == 0 {
		return errors.New("default project is empty")
	}
	var project map[string]json.RawMessage
	if err := json.Unmarshal(data, &project); err != nil || project == nil {
		return errors.New("default project must be a JSON object")
	}
	var version int
	if raw, ok := project["schemaVersion"]; !ok || json.Unmarshal(raw, &version) != nil || version < 1 {
		return errors.New("default project schemaVersion must be a positive integer")
	}
	var title string
	if raw, ok := project["title"]; !ok || json.Unmarshal(raw, &title) != nil {
		return errors.New("default project title must be a string")
	}
	var devices []json.RawMessage
	if raw, ok := project["devices"]; !ok || json.Unmarshal(raw, &devices) != nil || devices == nil {
		return errors.New("default project devices must be an array")
	}
	var networks []json.RawMessage
	if raw, ok := project["networks"]; !ok || json.Unmarshal(raw, &networks) != nil || networks == nil {
		return errors.New("default project networks must be an array")
	}
	return nil
}

func writeAPIError(writer http.ResponseWriter, request *http.Request, status int, message string) {
	writer.Header().Set("Content-Type", "text/plain; charset=utf-8")
	writer.WriteHeader(status)
	if request.Method != http.MethodHead {
		_, _ = fmt.Fprintln(writer, message)
	}
}
