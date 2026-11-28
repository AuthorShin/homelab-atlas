package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var dataURLPattern = regexp.MustCompile(`^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$`)

var errVectorizerUnavailable = errors.New("image vectorization is unavailable")

type vectorizeClient struct {
	url    string
	client *http.Client
}

func newVectorizeClient(rawURL string) *vectorizeClient {
	url := strings.TrimSpace(rawURL)
	if url == "" {
		return &vectorizeClient{}
	}
	return &vectorizeClient{
		url:    strings.TrimRight(url, "/"),
		client: &http.Client{Timeout: 100 * time.Second},
	}
}

func (client *vectorizeClient) available() bool {
	return client != nil && client.url != "" && client.client != nil
}

func (client *vectorizeClient) vectorize(data []byte, mediaType string) ([]byte, error) {
	if !client.available() {
		return nil, errVectorizerUnavailable
	}
	if len(data) == 0 || len(data) > maxUploadBytes {
		return nil, errors.New("image must be between 1 byte and 2 MB")
	}
	request, err := http.NewRequest(http.MethodPost, client.url+"/vectorize", bytes.NewReader(data))
	if err != nil {
		return nil, errors.New("vectorizer request could not be created")
	}
	request.Header.Set("Content-Type", mediaType)
	response, err := client.client.Do(request)
	if err != nil {
		return nil, errors.New("image vectorization service could not be reached")
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, maxUploadBytes+1))
	if err != nil {
		return nil, errors.New("vectorizer response could not be read")
	}
	if response.StatusCode != http.StatusOK {
		detail := strings.TrimSpace(string(body))
		if detail == "" {
			detail = "vectorization failed"
		}
		return nil, errors.New(detail)
	}
	if len(body) > maxUploadBytes {
		return nil, errors.New("vectorized SVG is too large")
	}
	if err := validateUploadedImage("image/svg+xml", body); err != nil {
		return nil, errors.New("vectorizer produced an unsafe SVG")
	}
	return body, nil
}

func (server *atlasServer) storeVectorized(svg []byte) (string, error) {
	digest := sha256.Sum256(svg)
	name := hex.EncodeToString(digest[:]) + ".svg"
	if err := server.uploads.put(name, svg); err != nil {
		return "", err
	}
	return "/api/uploads/" + name, nil
}

func (server *atlasServer) readUploadReference(reference string) ([]byte, string, error) {
	if !isUploadReference(reference) {
		return nil, "", errors.New("invalid upload reference")
	}
	name := strings.TrimPrefix(reference, "/api/uploads/")
	data, err := os.ReadFile(filepath.Join(server.uploads.directory, name))
	if err != nil {
		return nil, "", errors.New("uploaded image could not be read")
	}
	return data, uploadContentTypes[filepath.Ext(name)], nil
}

func decodeVectorizeDataURL(value string) ([]byte, string, error) {
	match := dataURLPattern.FindStringSubmatch(strings.TrimSpace(value))
	if match == nil {
		return nil, "", errors.New("image data must be a base64 data URL")
	}
	mediaType := strings.ToLower(match[1])
	if _, ok := map[string]bool{"image/png": true, "image/jpeg": true, "image/gif": true, "image/bmp": true, "image/tiff": true}[mediaType]; !ok {
		return nil, "", errors.New("image must be PNG, JPG, GIF, BMP, or TIFF")
	}
	data, err := base64.StdEncoding.DecodeString(match[2])
	if err != nil {
		return nil, "", errors.New("image data is not valid base64")
	}
	return data, mediaType, nil
}

func (server *atlasServer) serveVectorize(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	if request.Method != http.MethodPost {
		methodNotAllowed(writer, "POST")
		return
	}
	if request.Header.Get(uploadWriteHeader) != "1" {
		writeAPIError(writer, request, http.StatusForbidden, "image vectorization requires the Atlas request header")
		return
	}
	if !server.uploads.available() {
		writeAPIError(writer, request, http.StatusServiceUnavailable, errStoreUnavailable.Error())
		return
	}
	if !server.vectorizer.available() {
		writeAPIError(writer, request, http.StatusServiceUnavailable, errVectorizerUnavailable.Error())
		return
	}
	var payload struct {
		URL  string `json:"url"`
		Data string `json:"data"`
	}
	decoder := json.NewDecoder(io.LimitReader(request.Body, 2*maxUploadBytes))
	if err := decoder.Decode(&payload); err != nil {
		writeAPIError(writer, request, http.StatusBadRequest, "vectorization request must be JSON")
		return
	}
	var data []byte
	var mediaType string
	var err error
	switch {
	case payload.URL != "" && payload.Data == "":
		data, mediaType, err = server.readUploadReference(payload.URL)
	case payload.Data != "" && payload.URL == "":
		data, mediaType, err = decodeVectorizeDataURL(payload.Data)
	default:
		err = errors.New("provide either an upload URL or image data")
	}
	if err != nil {
		writeAPIError(writer, request, http.StatusBadRequest, err.Error())
		return
	}
	svg, err := server.vectorizer.vectorize(data, mediaType)
	if err != nil {
		status := http.StatusBadGateway
		if errors.Is(err, errVectorizerUnavailable) {
			status = http.StatusServiceUnavailable
		}
		writeAPIError(writer, request, status, err.Error())
		return
	}
	url, err := server.storeVectorized(svg)
	if err != nil {
		writeAPIError(writer, request, http.StatusInternalServerError, err.Error())
		return
	}
	encoded, err := json.Marshal(struct {
		URL string `json:"url"`
	}{URL: url})
	if err != nil {
		writeAPIError(writer, request, http.StatusInternalServerError, "vectorization response could not be encoded")
		return
	}
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.Header().Set("Content-Length", strconv.Itoa(len(encoded)))
	writer.WriteHeader(http.StatusCreated)
	_, _ = writer.Write(encoded)
}
