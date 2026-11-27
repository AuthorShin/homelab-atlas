package main

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	brandingFilename       = "branding.json"
	brandingWriteHeader    = "X-Atlas-Branding"
	maxBrandingBytes       = 200_000
	maxBrandNameRunes      = 60
	maxBrandTabTitleRunes  = 80
	maxBrandFaviconChars   = 120_000
	maxBrandFaviconBytes   = 150_000
	minBrandFaviconBytes   = 45
	brandFaviconPrefix     = "data:image/png;base64,"
	brandFaviconDimensions = 128
)

type brandingSettings struct {
	Name     string `json:"name"`
	TabTitle string `json:"tabTitle"`
	Favicon  string `json:"favicon"`
}

func newBrandingStore(directory string) *jsonFileStore {
	return newJSONFileStore(directory, brandingFilename, "App branding")
}

func (server *atlasServer) serveBranding(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	writer.Header().Set("X-Content-Type-Options", "nosniff")

	switch request.Method {
	case http.MethodGet, http.MethodHead:
		data, found, err := server.branding.get()
		if err != nil {
			writeBrandingError(writer, request, err)
			return
		}
		if !found {
			writeAPIError(writer, request, http.StatusNotFound, "no app branding is saved")
			return
		}
		settings, err := parseBranding(data)
		if err != nil {
			writeAPIError(writer, request, http.StatusInternalServerError, "stored app branding is invalid")
			return
		}
		encoded, err := json.Marshal(settings)
		if err != nil {
			writeAPIError(writer, request, http.StatusInternalServerError, "app branding could not be encoded")
			return
		}
		writer.Header().Set("Content-Type", "application/json; charset=utf-8")
		writer.Header().Set("Content-Length", strconv.Itoa(len(encoded)))
		writer.WriteHeader(http.StatusOK)
		if request.Method != http.MethodHead {
			_, _ = writer.Write(encoded)
		}
	case http.MethodPut:
		if request.Header.Get(brandingWriteHeader) != "1" {
			writeAPIError(writer, request, http.StatusForbidden, "app branding writes require the Atlas request header")
			return
		}
		mediaType, _, err := mime.ParseMediaType(request.Header.Get("Content-Type"))
		if err != nil || mediaType != "application/json" {
			writeAPIError(writer, request, http.StatusUnsupportedMediaType, "app branding must be application/json")
			return
		}
		request.Body = http.MaxBytesReader(writer, request.Body, maxBrandingBytes+1)
		data, err := io.ReadAll(request.Body)
		if err != nil {
			var tooLarge *http.MaxBytesError
			if errors.As(err, &tooLarge) || len(data) > maxBrandingBytes {
				writeAPIError(writer, request, http.StatusRequestEntityTooLarge, "app branding is larger than 200 KB")
				return
			}
			writeAPIError(writer, request, http.StatusBadRequest, "app branding could not be read")
			return
		}
		if len(data) > maxBrandingBytes {
			writeAPIError(writer, request, http.StatusRequestEntityTooLarge, "app branding is larger than 200 KB")
			return
		}
		settings, err := parseBranding(data)
		if err != nil {
			writeAPIError(writer, request, http.StatusBadRequest, err.Error())
			return
		}
		encoded, err := json.Marshal(settings)
		if err != nil {
			writeAPIError(writer, request, http.StatusInternalServerError, "app branding could not be encoded")
			return
		}
		if err := server.branding.put(encoded); err != nil {
			writeBrandingError(writer, request, err)
			return
		}
		writer.WriteHeader(http.StatusNoContent)
	case http.MethodDelete:
		if request.Header.Get(brandingWriteHeader) != "1" {
			writeAPIError(writer, request, http.StatusForbidden, "app branding writes require the Atlas request header")
			return
		}
		if err := server.branding.delete(); err != nil {
			writeBrandingError(writer, request, err)
			return
		}
		writer.WriteHeader(http.StatusNoContent)
	default:
		methodNotAllowed(writer, "GET, HEAD, PUT, DELETE")
	}
}

func writeBrandingError(writer http.ResponseWriter, request *http.Request, err error) {
	status := http.StatusInternalServerError
	if errors.Is(err, errStoreUnavailable) {
		status = http.StatusServiceUnavailable
	}
	writeAPIError(writer, request, status, err.Error())
}

func parseBranding(data []byte) (brandingSettings, error) {
	if len(bytes.TrimSpace(data)) == 0 {
		return brandingSettings{}, errors.New("app branding is empty")
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	var object map[string]json.RawMessage
	if err := decoder.Decode(&object); err != nil || object == nil {
		return brandingSettings{}, errors.New("app branding must be a JSON object with name, tabTitle, and favicon")
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		return brandingSettings{}, errors.New("app branding must contain a single JSON object")
	}
	if len(object) != 3 {
		return brandingSettings{}, errors.New("app branding must contain exactly name, tabTitle, and favicon")
	}
	var settings brandingSettings
	for key, target := range map[string]*string{
		"name":     &settings.Name,
		"tabTitle": &settings.TabTitle,
		"favicon":  &settings.Favicon,
	} {
		raw, ok := object[key]
		if !ok || json.Unmarshal(raw, target) != nil {
			return brandingSettings{}, errors.New("app branding must contain string name, tabTitle, and favicon fields")
		}
	}
	return validateBranding(settings)
}

func validateBranding(settings brandingSettings) (brandingSettings, error) {
	name := strings.TrimSpace(settings.Name)
	if name == "" {
		return brandingSettings{}, errors.New("app name is required")
	}
	if utf8.RuneCountInString(name) > maxBrandNameRunes {
		return brandingSettings{}, fmt.Errorf("app name must be %d characters or fewer", maxBrandNameRunes)
	}
	if hasControlCharacters(name) {
		return brandingSettings{}, errors.New("app name contains unsupported control characters")
	}
	tabTitle := strings.TrimSpace(settings.TabTitle)
	if utf8.RuneCountInString(tabTitle) > maxBrandTabTitleRunes {
		return brandingSettings{}, fmt.Errorf("browser tab title must be %d characters or fewer", maxBrandTabTitleRunes)
	}
	if hasControlCharacters(tabTitle) {
		return brandingSettings{}, errors.New("browser tab title contains unsupported control characters")
	}
	if err := validateBrandingFavicon(settings.Favicon); err != nil {
		return brandingSettings{}, err
	}
	return brandingSettings{Name: name, TabTitle: tabTitle, Favicon: settings.Favicon}, nil
}

func hasControlCharacters(value string) bool {
	for _, character := range value {
		if unicode.IsControl(character) {
			return true
		}
	}
	return false
}

func validateBrandingFavicon(value string) error {
	if value == "" {
		return nil
	}
	if len(value) > maxBrandFaviconChars {
		return errors.New("app logo is too large")
	}
	if isUploadReference(value) {
		if !strings.HasSuffix(value, ".png") && !strings.HasSuffix(value, ".svg") {
			return errors.New("app logo uploads must be PNG or SVG images")
		}
		return nil
	}
	if !strings.HasPrefix(value, brandFaviconPrefix) {
		return errors.New("app logo must be an empty string, a PNG data URL, or an Atlas PNG or SVG upload")
	}
	encoded := strings.TrimPrefix(value, brandFaviconPrefix)
	if len(encoded)%4 != 0 {
		return errors.New("app logo must be a canonical PNG data URL")
	}
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || base64.StdEncoding.EncodeToString(decoded) != encoded {
		return errors.New("app logo must be a canonical PNG data URL")
	}
	if len(decoded) < minBrandFaviconBytes || len(decoded) > maxBrandFaviconBytes {
		return errors.New("app logo PNG has invalid data")
	}
	signature := []byte{137, 80, 78, 71, 13, 10, 26, 10}
	if !bytes.Equal(decoded[:8], signature) {
		return errors.New("app logo has an invalid PNG signature")
	}
	offset := 8
	width := uint32(0)
	height := uint32(0)
	hasImageData := false
	ended := false
	for offset+12 <= len(decoded) {
		size := int(binary.BigEndian.Uint32(decoded[offset:]))
		end := offset + 12 + size
		if end > len(decoded) {
			return errors.New("app logo PNG is truncated")
		}
		chunkType := string(decoded[offset+4 : offset+8])
		if offset == 8 && (chunkType != "IHDR" || size != 13) {
			return errors.New("app logo PNG has an invalid header")
		}
		if chunkType == "IHDR" {
			if width != 0 || height != 0 {
				return errors.New("app logo PNG has duplicate headers")
			}
			width = binary.BigEndian.Uint32(decoded[offset+8:])
			height = binary.BigEndian.Uint32(decoded[offset+12:])
			if width == 0 || height == 0 || width > brandFaviconDimensions || height > brandFaviconDimensions {
				return fmt.Errorf("app logo PNG dimensions must not exceed %dpx", brandFaviconDimensions)
			}
		}
		if chunkType == "IDAT" {
			hasImageData = true
		}
		offset = end
		if chunkType == "IEND" {
			if size != 0 || offset != len(decoded) {
				return errors.New("app logo PNG has an invalid terminator")
			}
			ended = true
			break
		}
	}
	if !ended || width == 0 || !hasImageData {
		return errors.New("app logo PNG is incomplete")
	}
	return nil
}
