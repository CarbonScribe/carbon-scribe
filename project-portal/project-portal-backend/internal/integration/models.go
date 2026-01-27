package integration

import (
	"time"

	"gorm.io/gorm"
)

// IntegrationConnection represents a connection to an external service
type IntegrationConnection struct {
	ID          string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	Name        string         `gorm:"not null" json:"name"`
	Provider    string         `gorm:"not null;index" json:"provider"`          // e.g., "stripe", "stellar", "sentinel"
	Environment string         `gorm:"default:'production'" json:"environment"` // development, staging, production
	Credentials map[string]any `gorm:"serializer:json" json:"-"`                // Stored securely, never returned in API
	Config      map[string]any `gorm:"serializer:json" json:"config"`
	Status      string         `gorm:"default:'active'" json:"status"` // active, inactive, error
	LastTested  *time.Time     `json:"last_tested,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// WebhookConfig represents an outgoing webhook configuration
type WebhookConfig struct {
	ID          string            `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	ProjectID   *string           `gorm:"index" json:"project_id,omitempty"` // Optional: scoped to a project
	URL         string            `gorm:"not null" json:"url"`
	Secret      string            `gorm:"not null" json:"-"` // Used for signing payload
	Events      []string          `gorm:"type:text[]" json:"events"`
	IsActive    bool              `gorm:"default:true" json:"is_active"`
	Headers     map[string]string `gorm:"serializer:json" json:"headers,omitempty"`
	RetryConfig map[string]any    `gorm:"serializer:json" json:"retry_config,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
	DeletedAt   gorm.DeletedAt    `gorm:"index" json:"-"`
}

// WebhookDelivery represents a log of a webhook attempt
type WebhookDelivery struct {
	ID             string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	WebhookID      string         `gorm:"index;not null" json:"webhook_id"`
	EventID        string         `gorm:"index;not null" json:"event_id"`
	EventType      string         `gorm:"index;not null" json:"event_type"`
	Payload        map[string]any `gorm:"serializer:json" json:"payload"`
	ResponseStatus int            `json:"response_status"`
	ResponseBody   string         `json:"response_body"`
	Status         string         `gorm:"index;not null" json:"status"` // success, failed, pending
	Attempt        int            `json:"attempt"`
	NextRetryAt    *time.Time     `gorm:"index" json:"next_retry_at,omitempty"`
	CreatedAt      time.Time      `json:"created_at"`
}

// EventSubscription represents an external service subscribing to internal events
type EventSubscription struct {
	ID           string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	SubscriberID string         `gorm:"index;not null" json:"subscriber_id"` // External system ID
	EventType    string         `gorm:"index;not null" json:"event_type"`
	Filters      map[string]any `gorm:"serializer:json" json:"filters,omitempty"`
	CallbackURL  string         `gorm:"not null" json:"callback_url"`
	IsActive     bool           `gorm:"default:true" json:"is_active"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// OAuthToken represents stored OAuth2 tokens for integrations
type OAuthToken struct {
	ID           string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	ConnectionID string    `gorm:"index;not null" json:"connection_id"`
	Provider     string    `gorm:"not null" json:"provider"`
	AccessToken  string    `gorm:"not null" json:"-"`
	RefreshToken string    `json:"-"`
	TokenType    string    `json:"token_type"`
	ExpiresAt    time.Time `json:"expires_at"`
	Scope        string    `json:"scope"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// IntegrationHealth represents the health status of a connection
type IntegrationHealth struct {
	ID           string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	ConnectionID string    `gorm:"index;not null" json:"connection_id"`
	Status       string    `gorm:"not null" json:"status"` // healthy, degraded, down
	LatencyMs    int       `json:"latency_ms"`
	ErrorRate    float64   `json:"error_rate"`
	CheckedAt    time.Time `gorm:"index" json:"checked_at"`
	Message      string    `json:"message,omitempty"`
}
