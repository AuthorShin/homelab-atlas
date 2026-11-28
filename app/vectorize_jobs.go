package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

type vectorizeJob struct {
	ID        string `json:"id"`
	Status    string `json:"status"`
	URL       string `json:"url,omitempty"`
	Error     string `json:"error,omitempty"`
	data      []byte
	mediaType string
	created   time.Time
}

type vectorizeJobStore struct {
	mutex sync.Mutex
	jobs  map[string]*vectorizeJob
}

func newVectorizeJobStore() *vectorizeJobStore {
	return &vectorizeJobStore{jobs: make(map[string]*vectorizeJob)}
}

func newVectorizeJobID() string {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	return hex.EncodeToString(bytes)
}

func (store *vectorizeJobStore) create(data []byte, mediaType string) string {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	for id, job := range store.jobs {
		if time.Since(job.created) > 30*time.Minute {
			delete(store.jobs, id)
		}
	}
	id := newVectorizeJobID()
	store.jobs[id] = &vectorizeJob{ID: id, Status: "pending", data: data, mediaType: mediaType, created: time.Now()}
	return id
}

func (store *vectorizeJobStore) get(id string) (vectorizeJob, bool) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	job, ok := store.jobs[id]
	if !ok {
		return vectorizeJob{}, false
	}
	return vectorizeJob{ID: job.ID, Status: job.Status, URL: job.URL, Error: job.Error}, true
}

func (store *vectorizeJobStore) set(id, status, url, message string) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	if job, ok := store.jobs[id]; ok {
		job.Status = status
		job.URL = url
		job.Error = message
	}
}

func (store *vectorizeJobStore) input(id string) ([]byte, string, bool) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	job, ok := store.jobs[id]
	if !ok {
		return nil, "", false
	}
	return job.data, job.mediaType, true
}

func (server *atlasServer) runVectorizeJob(id string) {
	server.vectorizeJobs.set(id, "processing", "", "")
	data, mediaType, ok := server.vectorizeJobs.input(id)
	if !ok {
		return
	}
	svg, err := server.vectorizer.vectorize(data, mediaType)
	if err != nil {
		status := "failed"
		if errors.Is(err, errVectorizerUnavailable) {
			status = "failed"
		}
		server.vectorizeJobs.set(id, status, "", err.Error())
		return
	}
	url, err := server.storeVectorized(svg)
	if err != nil {
		server.vectorizeJobs.set(id, "failed", "", err.Error())
		return
	}
	server.vectorizeJobs.set(id, "done", url, "")
}

func (server *atlasServer) serveVectorizeJobCreate(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	if request.Method != http.MethodPost {
		methodNotAllowed(writer, "POST")
		return
	}
	if request.Header.Get(uploadWriteHeader) != "1" {
		writeAPIError(writer, request, http.StatusForbidden, "image vectorization requires the Atlas request header")
		return
	}
	if !server.uploads.available() || !server.vectorizer.available() {
		writeAPIError(writer, request, http.StatusServiceUnavailable, errVectorizerUnavailable.Error())
		return
	}
	data, mediaType, err := server.decodeVectorizeInput(request)
	if err != nil {
		writeAPIError(writer, request, http.StatusBadRequest, err.Error())
		return
	}
	id := server.vectorizeJobs.create(data, mediaType)
	go server.runVectorizeJob(id)
	encoded, err := json.Marshal(struct {
		ID string `json:"id"`
	}{ID: id})
	if err != nil {
		writeAPIError(writer, request, http.StatusInternalServerError, "vectorization response could not be encoded")
		return
	}
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.Header().Set("Content-Length", strconv.Itoa(len(encoded)))
	writer.WriteHeader(http.StatusAccepted)
	_, _ = writer.Write(encoded)
}

func (server *atlasServer) serveVectorizeJobStatus(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	if request.Method != http.MethodGet {
		methodNotAllowed(writer, "GET")
		return
	}
	if request.Header.Get(uploadWriteHeader) != "1" {
		writeAPIError(writer, request, http.StatusForbidden, "image vectorization requires the Atlas request header")
		return
	}
	id := strings.TrimPrefix(request.URL.Path, "/api/vectorize/jobs/")
	job, ok := server.vectorizeJobs.get(id)
	if !ok {
		http.NotFound(writer, request)
		return
	}
	encoded, err := json.Marshal(job)
	if err != nil {
		writeAPIError(writer, request, http.StatusInternalServerError, "vectorization status could not be encoded")
		return
	}
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.Header().Set("Content-Length", strconv.Itoa(len(encoded)))
	writer.WriteHeader(http.StatusOK)
	_, _ = writer.Write(encoded)
}
