package ingestion

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

// WebhookReading represents a monitoring reading ingested via webhook.
type WebhookReading struct {
	ID          string
	ProjectID   string
	Source      string            // Webhook source identifier (e.g., "weather-api", "iot-platform")
	SourceType  string            // Type of source (e.g., "weather", "air_quality", "soil")
	MetricName  string            // Name of the metric (e.g., "temperature", "humidity", "pm25")
	MetricValue float64           // Value of the metric
	Unit        string            // Unit of measurement (e.g., "°C", "%", "µg/m³")
	Location    *Location         // Optional location data
	Metadata    map[string]string // Additional metadata
	CapturedAt  time.Time         // When the data was captured
	IngestedAt  time.Time         // When the data was ingested
	WebhookID   string            // Unique webhook request ID for deduplication
}

// Location represents geographic coordinates.
type Location struct {
	Latitude  float64  `json:"latitude"`
	Longitude float64  `json:"longitude"`
	Altitude  *float64 `json:"altitude,omitempty"`
}

// WebhookRequest is the validated input for the webhook pipeline.
type WebhookRequest struct {
	ProjectID   string
	Source      string
	SourceType  string
	MetricName  string
	MetricValue float64
	Unit        string
	Location    *Location
	Metadata    map[string]string
	CapturedAt  time.Time
	WebhookID   string
}

// WebhookRepository is the persistence contract for webhook data.
type WebhookRepository interface {
	SaveWebhookReading(ctx context.Context, reading *WebhookReading) error
	GetWebhookReadingByID(ctx context.Context, webhookID string) (*WebhookReading, error)
}

// WebhookPipeline validates and persists incoming webhook data.
type WebhookPipeline struct {
	repo WebhookRepository
}

// NewWebhookPipeline constructs a WebhookPipeline backed by the given repository.
func NewWebhookPipeline(repo WebhookRepository) *WebhookPipeline {
	return &WebhookPipeline{repo: repo}
}

// Ingest validates the webhook request and persists a WebhookReading.
func (p *WebhookPipeline) Ingest(ctx context.Context, req WebhookRequest) (*WebhookReading, error) {
	if err := validateWebhook(req); err != nil {
		return nil, err
	}

	// Check for duplicate webhook ID (idempotency)
	if req.WebhookID != "" {
		existing, err := p.repo.GetWebhookReadingByID(ctx, req.WebhookID)
		if err == nil && existing != nil {
			// Return the existing reading if duplicate
			return existing, nil
		}
	}

	now := time.Now().UTC()
	reading := &WebhookReading{
		ID:          uuid.NewString(),
		ProjectID:   req.ProjectID,
		Source:      strings.ToLower(req.Source),
		SourceType:  strings.ToLower(req.SourceType),
		MetricName:  strings.ToLower(req.MetricName),
		MetricValue: req.MetricValue,
		Unit:        req.Unit,
		Location:    req.Location,
		Metadata:    req.Metadata,
		CapturedAt:  req.CapturedAt.UTC(),
		IngestedAt:  now,
		WebhookID:   req.WebhookID,
	}

	if err := p.repo.SaveWebhookReading(ctx, reading); err != nil {
		return nil, fmt.Errorf("webhook ingestion: persist failed: %w", err)
	}

	return reading, nil
}

// validateWebhook checks required fields and value constraints.
func validateWebhook(req WebhookRequest) error {
	if strings.TrimSpace(req.ProjectID) == "" {
		return errors.New("project_id is required")
	}
	if strings.TrimSpace(req.Source) == "" {
		return errors.New("source is required")
	}
	if strings.TrimSpace(req.SourceType) == "" {
		return errors.New("source_type is required")
	}
	if strings.TrimSpace(req.MetricName) == "" {
		return errors.New("metric_name is required")
	}
	if req.CapturedAt.IsZero() {
		return errors.New("captured_at is required")
	}
	if req.CapturedAt.After(time.Now().UTC().Add(5 * time.Minute)) {
		return errors.New("captured_at cannot be in the future")
	}

	// Validate metric value range based on metric type
	switch strings.ToLower(req.MetricName) {
	case "temperature":
		if req.MetricValue < -50 || req.MetricValue > 60 {
			return errors.New("temperature must be in range [-50, 60] °C")
		}
	case "humidity":
		if req.MetricValue < 0 || req.MetricValue > 100 {
			return errors.New("humidity must be in range [0, 100] %")
		}
	case "pm25", "pm10":
		if req.MetricValue < 0 {
			return errors.New("particulate matter must be non-negative")
		}
	case "co2":
		if req.MetricValue < 0 {
			return errors.New("CO2 must be non-negative")
		}
	case "pressure":
		if req.MetricValue < 0 {
			return errors.New("pressure must be non-negative")
		}
	}

	return nil
}

// WebhookAuthConfig holds authentication configuration for webhooks.
type WebhookAuthConfig struct {
	APIKey     string
	HMACSecret string
	AllowedIPs []string
}

// WebhookAuthenticator handles webhook authentication.
type WebhookAuthenticator struct {
	config WebhookAuthConfig
}

// NewWebhookAuthenticator creates a new authenticator.
func NewWebhookAuthenticator(config WebhookAuthConfig) *WebhookAuthenticator {
	return &WebhookAuthenticator{config: config}
}

// Authenticate verifies the webhook request authenticity.
func (a *WebhookAuthenticator) Authenticate(r *http.Request) error {
	// Check API key
	apiKey := r.Header.Get("X-API-Key")
	if apiKey != "" {
		if a.config.APIKey != "" && apiKey == a.config.APIKey {
			return nil
		}
		return errors.New("invalid API key")
	}

	// Check HMAC signature
	signature := r.Header.Get("X-Signature")
	if signature != "" && a.config.HMACSecret != "" {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			return errors.New("failed to read body for HMAC verification")
		}
		// Restore body for later use
		r.Body = io.NopCloser(strings.NewReader(string(body)))

		mac := hmac.New(sha256.New, []byte(a.config.HMACSecret))
		mac.Write(body)
		expected := hex.EncodeToString(mac.Sum(nil))

		if hmac.Equal([]byte(signature), []byte(expected)) {
			return nil
		}
		return errors.New("invalid HMAC signature")
	}

	// Check IP whitelist
	clientIP := strings.Split(r.RemoteAddr, ":")[0]
	if len(a.config.AllowedIPs) > 0 {
		for _, ip := range a.config.AllowedIPs {
			if ip == clientIP {
				return nil
			}
		}
		return errors.New("IP not whitelisted")
	}

	// If no authentication method provided, allow (will be rejected by config)
	if a.config.APIKey == "" && a.config.HMACSecret == "" && len(a.config.AllowedIPs) == 0 {
		return nil
	}

	return errors.New("missing authentication credentials")
}
