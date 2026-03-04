package settings

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/datatypes"
)

type UserProfile struct {
	ID                uuid.UUID         `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID            uuid.UUID         `gorm:"type:uuid;uniqueIndex;not null" json:"user_id"`
	FullName          string            `gorm:"type:varchar(255)" json:"full_name,omitempty"`
	DisplayName       string            `gorm:"type:varchar(100)" json:"display_name,omitempty"`
	ProfilePictureURL string            `gorm:"type:text" json:"profile_picture_url,omitempty"`
	Bio               string            `gorm:"type:text" json:"bio,omitempty"`
	PhoneNumber       string            `gorm:"type:varchar(50)" json:"phone_number,omitempty"`
	PhoneVerified     bool              `gorm:"default:false" json:"phone_verified"`
	SecondaryEmail    string            `gorm:"type:varchar(255)" json:"secondary_email,omitempty"`
	Address           datatypes.JSONMap `gorm:"type:jsonb;default:'{}'" json:"address,omitempty"`
	Organization      string            `gorm:"type:varchar(255)" json:"organization,omitempty"`
	JobTitle          string            `gorm:"type:varchar(100)" json:"job_title,omitempty"`
	Website           string            `gorm:"type:varchar(500)" json:"website,omitempty"`
	Language          string            `gorm:"type:varchar(10);default:'en'" json:"language"`
	Timezone          string            `gorm:"type:varchar(50);default:'UTC'" json:"timezone"`
	Currency          string            `gorm:"type:varchar(3);default:'USD'" json:"currency"`
	DateFormat        string            `gorm:"type:varchar(20);default:'YYYY-MM-DD'" json:"date_format"`
	VerificationLevel string            `gorm:"type:varchar(50);default:'basic'" json:"verification_level"`
	VerificationData  datatypes.JSONMap `gorm:"type:jsonb;default:'{}'" json:"verification_data,omitempty"`
	CreatedAt         time.Time         `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt         time.Time         `gorm:"autoUpdateTime" json:"updated_at"`
}

func (UserProfile) TableName() string { return "user_profiles" }

type NotificationPreference struct {
	ID                     uuid.UUID         `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID                 uuid.UUID         `gorm:"type:uuid;uniqueIndex;not null" json:"user_id"`
	EmailEnabled           bool              `gorm:"default:true" json:"email_enabled"`
	SMSSEnabled            bool              `gorm:"column:sms_enabled;default:false" json:"sms_enabled"`
	PushEnabled            bool              `gorm:"default:true" json:"push_enabled"`
	InAppEnabled           bool              `gorm:"column:in_app_enabled;default:true" json:"in_app_enabled"`
	Categories             datatypes.JSONMap `gorm:"type:jsonb;default:'{}'" json:"categories"`
	QuietHoursEnabled      bool              `gorm:"default:false" json:"quiet_hours_enabled"`
	QuietHoursStart        string            `gorm:"type:time;default:'22:00:00'" json:"quiet_hours_start"`
	QuietHoursEnd          string            `gorm:"type:time;default:'08:00:00'" json:"quiet_hours_end"`
	QuietHoursTimezone     string            `gorm:"type:varchar(50);default:'UTC'" json:"quiet_hours_timezone"`
	EmergencyOverride      bool              `gorm:"column:emergency_override_enabled;default:true" json:"emergency_override_enabled"`
	EmergencySeverityLevel string            `gorm:"type:varchar(20);default:'critical'" json:"emergency_severity_level"`
	CreatedAt              time.Time         `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt              time.Time         `gorm:"autoUpdateTime" json:"updated_at"`
}

func (NotificationPreference) TableName() string { return "notification_preferences" }

type APIKey struct {
	ID                 uuid.UUID         `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID             uuid.UUID         `gorm:"type:uuid;index;not null" json:"user_id"`
	Name               string            `gorm:"type:varchar(255);not null" json:"name"`
	KeyPrefix          string            `gorm:"type:varchar(16);not null" json:"key_prefix"`
	KeyHash            string            `gorm:"type:varchar(255);not null" json:"-"`
	KeyLastFour        string            `gorm:"type:varchar(4);not null" json:"key_last_four"`
	Scopes             pq.StringArray    `gorm:"type:text[];default:'{}'" json:"scopes"`
	RateLimitPerMinute int               `gorm:"default:60" json:"rate_limit_per_minute"`
	RateLimitPerDay    int               `gorm:"default:1000" json:"rate_limit_per_day"`
	ExpiresAt          *time.Time        `json:"expires_at,omitempty"`
	IsActive           bool              `gorm:"default:true" json:"is_active"`
	LastUsedAt         *time.Time        `json:"last_used_at,omitempty"`
	Metadata           datatypes.JSONMap `gorm:"type:jsonb;default:'{}'" json:"metadata,omitempty"`
	CreatedAt          time.Time         `gorm:"autoCreateTime" json:"created_at"`
}

func (APIKey) TableName() string { return "api_keys" }

type IntegrationConfiguration struct {
	ID                       uuid.UUID         `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID                   uuid.UUID         `gorm:"type:uuid;index;not null" json:"user_id"`
	IntegrationType          string            `gorm:"type:varchar(100);not null" json:"integration_type"`
	IntegrationName          string            `gorm:"type:varchar(255);not null" json:"integration_name"`
	ConfigData               string            `gorm:"type:text;not null" json:"-"`
	ConfigHash               string            `gorm:"type:varchar(64);not null" json:"config_hash"`
	IsActive                 bool              `gorm:"default:true" json:"is_active"`
	IsValid                  bool              `gorm:"default:true" json:"is_valid"`
	LastSuccessfulConnection *time.Time        `json:"last_successful_connection,omitempty"`
	ConnectionError          string            `gorm:"type:text" json:"connection_error,omitempty"`
	WebhookURL               string            `gorm:"type:text" json:"webhook_url,omitempty"`
	WebhookSecret            string            `gorm:"type:varchar(255)" json:"-"`
	WebhookLastDelivered     *time.Time        `json:"webhook_last_delivered,omitempty"`
	Metadata                 datatypes.JSONMap `gorm:"type:jsonb;default:'{}'" json:"metadata,omitempty"`
	CreatedAt                time.Time         `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt                time.Time         `gorm:"autoUpdateTime" json:"updated_at"`
}

func (IntegrationConfiguration) TableName() string { return "integration_configurations" }

type Subscription struct {
	ID                 uuid.UUID         `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID             uuid.UUID         `gorm:"type:uuid;index;not null" json:"user_id"`
	PlanID             string            `gorm:"type:varchar(100);not null" json:"plan_id"`
	PlanName           string            `gorm:"type:varchar(255);not null" json:"plan_name"`
	BillingCycle       string            `gorm:"type:varchar(20);not null" json:"billing_cycle"`
	Status             string            `gorm:"type:varchar(50);default:'active'" json:"status"`
	CurrentPeriodStart time.Time         `json:"current_period_start"`
	CurrentPeriodEnd   time.Time         `json:"current_period_end"`
	CanceledAt         *time.Time        `json:"canceled_at,omitempty"`
	PaymentMethodID    string            `gorm:"type:varchar(255)" json:"payment_method_id,omitempty"`
	PaymentMethodType  string            `gorm:"type:varchar(50)" json:"payment_method_type,omitempty"`
	UsageMetrics       datatypes.JSONMap `gorm:"type:jsonb;default:'{}'" json:"usage_metrics,omitempty"`
	CreatedAt          time.Time         `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt          time.Time         `gorm:"autoUpdateTime" json:"updated_at"`
}

func (Subscription) TableName() string { return "subscriptions" }

type Invoice struct {
	ID                 uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	SubscriptionID     *uuid.UUID     `gorm:"type:uuid" json:"subscription_id,omitempty"`
	UserID             uuid.UUID      `gorm:"type:uuid;index;not null" json:"user_id"`
	InvoiceNumber      string         `gorm:"type:varchar(100);uniqueIndex;not null" json:"invoice_number"`
	Amount             float64        `gorm:"type:numeric(10,2);not null" json:"amount"`
	Currency           string         `gorm:"type:varchar(3);default:'USD'" json:"currency"`
	TaxAmount          float64        `gorm:"type:numeric(10,2);default:0" json:"tax_amount"`
	TotalAmount        float64        `gorm:"type:numeric(10,2);not null" json:"total_amount"`
	BillingPeriodStart time.Time      `json:"billing_period_start"`
	BillingPeriodEnd   time.Time      `json:"billing_period_end"`
	Status             string         `gorm:"type:varchar(50);default:'draft'" json:"status"`
	DueDate            *time.Time     `json:"due_date,omitempty"`
	PaidAt             *time.Time     `json:"paid_at,omitempty"`
	PaymentMethod      string         `gorm:"type:varchar(50)" json:"payment_method,omitempty"`
	TransactionID      string         `gorm:"type:varchar(255)" json:"transaction_id,omitempty"`
	LineItems          datatypes.JSON `gorm:"type:jsonb;default:'[]'" json:"line_items"`
	PDFURL             string         `gorm:"type:text" json:"pdf_url,omitempty"`
	PDFGeneratedAt     *time.Time     `json:"pdf_generated_at,omitempty"`
	CreatedAt          time.Time      `gorm:"autoCreateTime" json:"created_at"`
}

func (Invoice) TableName() string { return "invoices" }

type APIKeyPublic struct {
	ID                 uuid.UUID         `json:"id"`
	Name               string            `json:"name"`
	KeyPrefix          string            `json:"key_prefix"`
	KeyLastFour        string            `json:"key_last_four"`
	Scopes             []string          `json:"scopes"`
	RateLimitPerMinute int               `json:"rate_limit_per_minute"`
	RateLimitPerDay    int               `json:"rate_limit_per_day"`
	ExpiresAt          *time.Time        `json:"expires_at,omitempty"`
	IsActive           bool              `json:"is_active"`
	LastUsedAt         *time.Time        `json:"last_used_at,omitempty"`
	Metadata           datatypes.JSONMap `json:"metadata,omitempty"`
	CreatedAt          time.Time         `json:"created_at"`
}

type IntegrationConfigurationPublic struct {
	ID                       uuid.UUID         `json:"id"`
	IntegrationType          string            `json:"integration_type"`
	IntegrationName          string            `json:"integration_name"`
	ConfigHash               string            `json:"config_hash"`
	IsActive                 bool              `json:"is_active"`
	IsValid                  bool              `json:"is_valid"`
	LastSuccessfulConnection *time.Time        `json:"last_successful_connection,omitempty"`
	ConnectionError          string            `json:"connection_error,omitempty"`
	WebhookURL               string            `json:"webhook_url,omitempty"`
	WebhookLastDelivered     *time.Time        `json:"webhook_last_delivered,omitempty"`
	Metadata                 datatypes.JSONMap `json:"metadata,omitempty"`
	CreatedAt                time.Time         `json:"created_at"`
	UpdatedAt                time.Time         `json:"updated_at"`
}

type BillingSummary struct {
	Subscription *Subscription `json:"subscription,omitempty"`
	Invoices     []Invoice     `json:"invoices"`
}

type UpdateProfileRequest struct {
	FullName       string                 `json:"full_name"`
	DisplayName    string                 `json:"display_name"`
	Bio            string                 `json:"bio"`
	PhoneNumber    string                 `json:"phone_number"`
	SecondaryEmail string                 `json:"secondary_email"`
	Address        map[string]interface{} `json:"address"`
	Organization   string                 `json:"organization"`
	JobTitle       string                 `json:"job_title"`
	Website        string                 `json:"website"`
	Language       string                 `json:"language"`
	Timezone       string                 `json:"timezone"`
	Currency       string                 `json:"currency"`
	DateFormat     string                 `json:"date_format"`
}

type UpdateNotificationPreferencesRequest struct {
	EmailEnabled           *bool                  `json:"email_enabled"`
	SMSEnabled             *bool                  `json:"sms_enabled"`
	PushEnabled            *bool                  `json:"push_enabled"`
	InAppEnabled           *bool                  `json:"in_app_enabled"`
	Categories             map[string]interface{} `json:"categories"`
	QuietHoursEnabled      *bool                  `json:"quiet_hours_enabled"`
	QuietHoursStart        string                 `json:"quiet_hours_start"`
	QuietHoursEnd          string                 `json:"quiet_hours_end"`
	QuietHoursTimezone     string                 `json:"quiet_hours_timezone"`
	EmergencyOverride      *bool                  `json:"emergency_override_enabled"`
	EmergencySeverityLevel string                 `json:"emergency_severity_level"`
}

type CreateAPIKeyRequest struct {
	Name               string                 `json:"name"`
	Scopes             []string               `json:"scopes"`
	RateLimitPerMinute int                    `json:"rate_limit_per_minute"`
	RateLimitPerDay    int                    `json:"rate_limit_per_day"`
	ExpiresAt          *time.Time             `json:"expires_at"`
	Metadata           map[string]interface{} `json:"metadata"`
}

type CreateAPIKeyResponse struct {
	APIKey  APIKeyPublic `json:"api_key"`
	Secret  string       `json:"secret"`
	Message string       `json:"message"`
}

type ConfigureIntegrationRequest struct {
	IntegrationType string                 `json:"integration_type"`
	IntegrationName string                 `json:"integration_name"`
	Config          map[string]interface{} `json:"config"`
	WebhookURL      string                 `json:"webhook_url"`
	WebhookSecret   string                 `json:"webhook_secret"`
	IsActive        *bool                  `json:"is_active"`
	Metadata        map[string]interface{} `json:"metadata"`
}

type AddPaymentMethodRequest struct {
	PaymentMethodID   string `json:"payment_method_id"`
	PaymentMethodType string `json:"payment_method_type"`
}

type ConfigureAPIKeyWebhooksRequest struct {
	Webhooks []APIKeyWebhookSubscription `json:"webhooks"`
}

type APIKeyWebhookSubscription struct {
	Event       string `json:"event"`
	TargetURL   string `json:"target_url"`
	Description string `json:"description,omitempty"`
	IsActive    bool   `json:"is_active"`
}

type APIKeyUsageAnalytics struct {
	KeyID                 uuid.UUID  `json:"key_id"`
	RequestCountTotal     int64      `json:"request_count_total"`
	RequestCountToday     int64      `json:"request_count_today"`
	LastUsedAt            *time.Time `json:"last_used_at,omitempty"`
	LastRateLimitExceeded *time.Time `json:"last_rate_limit_exceeded,omitempty"`
	RateLimitPerMinute    int        `json:"rate_limit_per_minute"`
	RateLimitPerDay       int        `json:"rate_limit_per_day"`
}

type ValidateAPIKeyRequest struct {
	Secret string `json:"secret"`
}

type ValidateAPIKeyResponse struct {
	Valid         bool                  `json:"valid"`
	Key           *APIKeyPublic         `json:"key,omitempty"`
	Usage         *APIKeyUsageAnalytics `json:"usage,omitempty"`
	Error         string                `json:"error,omitempty"`
	RateLimited   bool                  `json:"rate_limited,omitempty"`
	RetryAfterSec int                   `json:"retry_after_sec,omitempty"`
}

type DeleteProfileResponse struct {
	Message string `json:"message"`
}

type OAuthStartResponse struct {
	Provider     string    `json:"provider"`
	State        string    `json:"state"`
	RedirectURL  string    `json:"redirect_url"`
	ExpiresAt    time.Time `json:"expires_at"`
	CallbackPath string    `json:"callback_path"`
}

type OAuthCallbackRequest struct {
	State           string `json:"state"`
	Code            string `json:"code"`
	IntegrationName string `json:"integration_name"`
}

type OAuthCallbackResponse struct {
	Provider    string                          `json:"provider"`
	Connected   bool                            `json:"connected"`
	Integration *IntegrationConfigurationPublic `json:"integration,omitempty"`
	Message     string                          `json:"message"`
}

type BatchConfigureIntegrationsRequest struct {
	Items []ConfigureIntegrationRequest `json:"items"`
}

type IntegrationHealthResponse struct {
	IntegrationID    uuid.UUID  `json:"integration_id"`
	Health           string     `json:"health"`
	IsActive         bool       `json:"is_active"`
	IsValid          bool       `json:"is_valid"`
	RotationDue      bool       `json:"rotation_due"`
	LastCheckedAt    time.Time  `json:"last_checked_at"`
	LastSuccessfulAt *time.Time `json:"last_successful_at,omitempty"`
	ConnectionError  string     `json:"connection_error,omitempty"`
}

type InvoicePDFResponse struct {
	InvoiceID     uuid.UUID  `json:"invoice_id"`
	InvoiceNumber string     `json:"invoice_number"`
	PDFURL        string     `json:"pdf_url"`
	GeneratedAt   *time.Time `json:"generated_at,omitempty"`
}

type ProfilePictureUploadResponse struct {
	ProfilePictureURL string `json:"profile_picture_url"`
	Message           string `json:"message"`
}

func defaultNotificationCategories() datatypes.JSONMap {
	return datatypes.JSONMap{
		"monitoring_alerts":    map[string]bool{"email": true, "push": true},
		"financial_updates":    map[string]bool{"email": true, "push": false},
		"system_announcements": map[string]bool{"email": true, "push": true},
		"project_updates":      map[string]bool{"email": true, "push": true},
		"team_collaboration":   map[string]bool{"email": false, "push": true},
	}
}
