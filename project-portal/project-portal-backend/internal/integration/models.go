package integration

import (
	"encoding/json"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// IntegrationConnection represents a connection to an external service
type IntegrationConnection struct {
	ID          string `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	Name        string `gorm:"not null" json:"name"`
	Provider    string `gorm:"not null;index" json:"provider"`          // e.g., "stripe", "stellar", "sentinel"
	Environment string `gorm:"default:'production'" json:"environment"` // development, staging, production

	// Credentials holds the decrypted value in memory only — it is never
	// persisted directly (gorm:"-"). BeforeSave/AfterFind below encrypt it
	// into CredentialsCiphertext/CredentialsKeyVersion before it reaches the
	// database and decrypt it back on read (#795). Never log this field.
	Credentials map[string]any `gorm:"-" json:"-"`
	// CredentialsCiphertext is the AES-GCM-encrypted, base64-encoded form of
	// Credentials actually stored in the database.
	CredentialsCiphertext string `gorm:"column:credentials_ciphertext" json:"-"`
	// CredentialsKeyVersion records which encryption key encrypted
	// CredentialsCiphertext, so key_rotation.go can re-encrypt old rows
	// after the active key changes. 0 means "no credentials set".
	CredentialsKeyVersion int `gorm:"column:credentials_key_version" json:"-"`

	Config     map[string]any `gorm:"serializer:json" json:"config"`
	Status     string         `gorm:"default:'active'" json:"status"` // active, inactive, error
	LastTested *time.Time     `json:"last_tested,omitempty"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeSave encrypts Credentials into CredentialsCiphertext/
// CredentialsKeyVersion before the row is written (#795).
func (c *IntegrationConnection) BeforeSave(tx *gorm.DB) error {
	if c.Credentials == nil {
		return nil
	}
	if credentialsKeyring == nil {
		return fmt.Errorf("integration: credentials keyring not configured — call SetCredentialsKeyring before persisting connections")
	}
	plaintext, err := json.Marshal(c.Credentials)
	if err != nil {
		return fmt.Errorf("marshal credentials: %w", err)
	}
	ciphertext, version, err := credentialsKeyring.Encrypt(string(plaintext))
	if err != nil {
		return fmt.Errorf("encrypt credentials: %w", err)
	}
	c.CredentialsCiphertext = ciphertext
	c.CredentialsKeyVersion = version
	return nil
}

// AfterFind decrypts CredentialsCiphertext back into Credentials so the
// service layer always sees the plaintext map (#795).
func (c *IntegrationConnection) AfterFind(tx *gorm.DB) error {
	if c.CredentialsCiphertext == "" {
		return nil
	}
	if credentialsKeyring == nil {
		return fmt.Errorf("integration: credentials keyring not configured — call SetCredentialsKeyring before reading connections")
	}
	plaintext, err := credentialsKeyring.Decrypt(c.CredentialsCiphertext, c.CredentialsKeyVersion)
	if err != nil {
		return fmt.Errorf("decrypt credentials: %w", err)
	}
	var creds map[string]any
	if err := json.Unmarshal([]byte(plaintext), &creds); err != nil {
		return fmt.Errorf("unmarshal decrypted credentials: %w", err)
	}
	c.Credentials = creds
	return nil
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
	Status         string         `gorm:"index;not null" json:"status"` // pending, success, failed, dead_letter
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
	Secret       string         `gorm:"not null;default:''" json:"secret,omitempty"`
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

// OAuthState represents a pending OAuth2 authorization request, storing the
// CSRF-protection state value and PKCE code_verifier issued by
// InitiateOAuth2 until they are consumed (or expire) at OAuth2Callback.
type OAuthState struct {
	ID           string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	State        string    `gorm:"uniqueIndex;not null" json:"-"`
	Provider     string    `gorm:"not null;index" json:"provider"`
	ConnectionID string    `gorm:"index;not null" json:"connection_id"`
	CodeVerifier string    `gorm:"not null" json:"-"`
	RedirectURI  string    `json:"-"`
	Consumed     bool      `gorm:"default:false;index" json:"-"`
	ExpiresAt    time.Time `gorm:"index;not null" json:"-"`
	CreatedAt    time.Time `json:"created_at"`
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
