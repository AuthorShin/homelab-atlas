package main

import (
	"errors"
	"log"
	"os"
	"path/filepath"
	"sync"
)

var errStoreUnavailable = errors.New("storage is unavailable")

// jsonFileStore is a small atomic single-file JSON store. It keeps the app
// usable when the data directory is missing or read-only.
type jsonFileStore struct {
	path  string
	label string
	mu    sync.RWMutex
}

func newJSONFileStore(directory, filename, label string) *jsonFileStore {
	store := &jsonFileStore{label: label}
	if directory == "" {
		log.Printf("%s storage is disabled because ATLAS_DATA_DIR is empty", label)
		return store
	}
	if err := os.MkdirAll(directory, 0o755); err != nil {
		log.Printf("%s storage is unavailable: %v", label, err)
		return store
	}
	probe, err := os.CreateTemp(directory, ".atlas-write-*")
	if err != nil {
		log.Printf("%s storage is unavailable: %v", label, err)
		return store
	}
	probeName := probe.Name()
	if err := probe.Close(); err != nil {
		_ = os.Remove(probeName)
		log.Printf("%s storage is unavailable: %v", label, err)
		return store
	}
	if err := os.Remove(probeName); err != nil {
		log.Printf("%s storage is unavailable: %v", label, err)
		return store
	}
	store.path = filepath.Join(directory, filename)
	return store
}

func (store *jsonFileStore) get() ([]byte, bool, error) {
	if store.path == "" {
		return nil, false, errStoreUnavailable
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

func (store *jsonFileStore) put(data []byte) error {
	if store.path == "" {
		return errStoreUnavailable
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	directory := filepath.Dir(store.path)
	temporary, err := os.CreateTemp(directory, ".json-store-*")
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

func (store *jsonFileStore) delete() error {
	if store.path == "" {
		return errStoreUnavailable
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	if err := os.Remove(store.path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}
