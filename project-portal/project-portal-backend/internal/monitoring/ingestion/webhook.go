package ingestion

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring"
)

// WebhookHandler handles webhook requests from satellite providers
type WebhookHandler struct {
	satelliteIngestion *SatelliteIngestion
	secretKeys         map[string]string // Map of satellite source to secret key
}

// NewWebhookHandler creates a new webhook handler
func NewWebhookHandler(satelliteIngestion *SatelliteIngestion, secretKeys map[string]string) *WebhookHandler {
	return &WebhookHandler{
		satelliteIngestion: satelliteIngestion,
		secretKeys:         secretKeys,
	}
}

// HandleSatelliteWebhook processes incoming satellite data webhooks
func (h *WebhookHandler) HandleSatelliteWebhook(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Read request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		h.sendError(w, http.StatusBadRequest, "failed to read request body", err)
		return
	}
	defer r.Body.Close()

	// Verify webhook signature if provided
	signature := r.Header.Get("X-Satellite-Signature")
	source := r.Header.Get("X-Satellite-Source")
	
	if signature != "" && source != "" {
		if !h.verifySignature(body, signature, source) {
			h.sendError(w, http.StatusUnauthorized, "invalid webhook signature", nil)
			return
		}
	}

	// Parse webhook payload
	var payload monitoring.SatelliteWebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		h.sendError(w, http.StatusBadRequest, "invalid JSON payload", err)
		return
	}

	// Process the webhook
	if err := h.satelliteIngestion.ProcessWebhook(ctx, payload); err != nil {
		h.sendError(w, http.StatusInternalServerError, "failed to process webhook", err)
		return
	}

	// Send success response
	h.sendSuccess(w, map[string]interface{}{
		"status":  "success",
		"message": "satellite data processed successfully",
		"tile_id": payload.TileID,
	})
}

// HandleBatchWebhook processes batch satellite data webhooks
func (h *WebhookHandler) HandleBatchWebhook(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Read request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		h.sendError(w, http.StatusBadRequest, "failed to read request body", err)
		return
	}
	defer r.Body.Close()

	// Parse batch payload
	var payloads []monitoring.SatelliteWebhookPayload
	if err := json.Unmarshal(body, &payloads); err != nil {
		h.sendError(w, http.StatusBadRequest, "invalid JSON payload", err)
		return
	}

	if len(payloads) == 0 {
		h.sendError(w, http.StatusBadRequest, "empty batch payload", nil)
		return
	}

	// Process batch with timeout
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	if err := h.satelliteIngestion.ProcessBatch(ctx, payloads); err != nil {
		h.sendError(w, http.StatusInternalServerError, "failed to process batch", err)
		return
	}

	// Send success response
	h.sendSuccess(w, map[string]interface{}{
		"status":           "success",
		"message":          "batch processed successfully",
		"observations_count": len(payloads),
	})
}

// verifySignature verifies the webhook signature using HMAC-SHA256
func (h *WebhookHandler) verifySignature(body []byte, signature, source string) bool {
	secretKey, exists := h.secretKeys[source]
	if !exists {
		return false
	}

	// Calculate expected signature
	mac := hmac.New(sha256.New, []byte(secretKey))
	mac.Write(body)
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	// Compare signatures (constant time comparison to prevent timing attacks)
	return hmac.Equal([]byte(signature), []byte(expectedSignature))
}

// sendError sends an error response
func (h *WebhookHandler) sendError(w http.ResponseWriter, statusCode int, message string, err error) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	response := map[string]interface{}{
		"status":  "error",
		"message": message,
	}

	if err != nil {
		response["error"] = err.Error()
	}

	json.NewEncoder(w).Encode(response)
}

// sendSuccess sends a success response
func (h *WebhookHandler) sendSuccess(w http.ResponseWriter, data map[string]interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(data)
}

// SatelliteDataFetcher handles scheduled pulling of satellite data from APIs
type SatelliteDataFetcher struct {
	satelliteIngestion *SatelliteIngestion
	apiClients         map[string]SatelliteAPIClient
}

// SatelliteAPIClient interface for different satellite providers
type SatelliteAPIClient interface {
	FetchLatestData(ctx context.Context, projectID string, startDate, endDate time.Time) ([]monitoring.SatelliteWebhookPayload, error)
	GetAvailableTiles(ctx context.Context, geometry interface{}) ([]string, error)
}

// NewSatelliteDataFetcher creates a new satellite data fetcher
func NewSatelliteDataFetcher(satelliteIngestion *SatelliteIngestion) *SatelliteDataFetcher {
	return &SatelliteDataFetcher{
		satelliteIngestion: satelliteIngestion,
		apiClients:         make(map[string]SatelliteAPIClient),
	}
}

// RegisterAPIClient registers a satellite API client for a specific source
func (f *SatelliteDataFetcher) RegisterAPIClient(source string, client SatelliteAPIClient) {
	f.apiClients[source] = client
}

// FetchAndProcessData fetches and processes satellite data for a project
func (f *SatelliteDataFetcher) FetchAndProcessData(ctx context.Context, projectID string, source string, startDate, endDate time.Time) error {
	client, exists := f.apiClients[source]
	if !exists {
		return fmt.Errorf("no API client registered for source: %s", source)
	}

	// Fetch data from satellite API
	payloads, err := client.FetchLatestData(ctx, projectID, startDate, endDate)
	if err != nil {
		return fmt.Errorf("failed to fetch satellite data: %w", err)
	}

	if len(payloads) == 0 {
		return errors.New("no satellite data available for the specified period")
	}

	// Process the fetched data
	return f.satelliteIngestion.ProcessBatch(ctx, payloads)
}

// ScheduledFetch performs scheduled data fetching for all projects
func (f *SatelliteDataFetcher) ScheduledFetch(ctx context.Context, projects []string, sources []string, lookbackDays int) error {
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -lookbackDays)

	for _, projectID := range projects {
		for _, source := range sources {
			if err := f.FetchAndProcessData(ctx, projectID, source, startDate, endDate); err != nil {
				// Log error but continue with other projects/sources
				fmt.Printf("Error fetching data for project %s from %s: %v\n", projectID, source, err)
				continue
			}
		}
	}

	return nil
}
