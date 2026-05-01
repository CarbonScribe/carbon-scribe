package notifications

import "time"

const (
	ChannelEmail     = "EMAIL"
	ChannelSMS       = "SMS"
	ChannelWebSocket = "WS"
	ChannelInApp     = "IN_APP"

	StatusPending   = "PENDING"
	StatusSent      = "SENT"
	StatusDelivered = "DELIVERED"
	StatusFailed    = "FAILED"
)

type Notification struct {
	ID          string                 `json:"id" bson:"_id"`
	UserID      string                 `json:"user_id" bson:"user_id"`
	ProjectID   string                 `json:"project_id,omitempty" bson:"project_id,omitempty"`
	Category    string                 `json:"category" bson:"category"`
	Subject     string                 `json:"subject" bson:"subject"`
	Content     string                 `json:"content" bson:"content"`
	Channels    []string               `json:"channels" bson:"channels"`
	Status      string                 `json:"status" bson:"status"`
	TemplateID  string                 `json:"template_id,omitempty" bson:"template_id,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty" bson:"metadata,omitempty"`
	CreatedAt   time.Time              `json:"created_at" bson:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at" bson:"updated_at"`
	DeliveredAt *time.Time             `json:"delivered_at,omitempty" bson:"delivered_at,omitempty"`
}

type DeliveryAttempt struct {
	NotificationID    string                 `json:"notification_id" bson:"notification_id"`
	AttemptID         string                 `json:"attempt_id" bson:"_id"`
	UserID            string                 `json:"user_id" bson:"user_id"`
	Channel           string                 `json:"channel" bson:"channel"`
	Status            string                 `json:"status" bson:"status"`
	ProviderMessageID string                 `json:"provider_message_id,omitempty" bson:"provider_message_id,omitempty"`
	ProviderResponse  map[string]interface{} `json:"provider_response,omitempty" bson:"provider_response,omitempty"`
	RetryCount        int                    `json:"retry_count" bson:"retry_count"`
	FinalStatus       string                 `json:"final_status,omitempty" bson:"final_status,omitempty"`
	CreatedAt         time.Time              `json:"created_at" bson:"created_at"`
}

type NotificationTemplate struct {
	ID        string                 `json:"id" bson:"_id"`
	Type      string                 `json:"type" bson:"type"`
	Language  string                 `json:"language" bson:"language"`
	Version   int                    `json:"version" bson:"version"`
	Name      string                 `json:"name" bson:"name"`
	Subject   string                 `json:"subject" bson:"subject"`
	Body      string                 `json:"body" bson:"body"`
	Variables []string               `json:"variables" bson:"variables"`
	IsActive  bool                   `json:"is_active" bson:"is_active"`
	Metadata  map[string]interface{} `json:"metadata,omitempty" bson:"metadata,omitempty"`
	CreatedAt time.Time              `json:"created_at" bson:"created_at"`
	UpdatedAt time.Time              `json:"updated_at" bson:"updated_at"`
}

type RuleCondition struct {
	Type     string      `json:"type" bson:"type"`
	Field    string      `json:"field" bson:"field"`
	Operator string      `json:"operator" bson:"operator"`
	Value    interface{} `json:"value" bson:"value"`
}

type RuleAction struct {
	Channel    string                 `json:"channel" bson:"channel"`
	TemplateID string                 `json:"template_id,omitempty" bson:"template_id,omitempty"`
	Target     string                 `json:"target,omitempty" bson:"target,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty" bson:"metadata,omitempty"`
}

type NotificationRule struct {
	ID            string                 `json:"id" bson:"_id"`
	ProjectID     string                 `json:"project_id" bson:"project_id"`
	Name          string                 `json:"name" bson:"name"`
	Description   string                 `json:"description,omitempty" bson:"description,omitempty"`
	Conditions    []RuleCondition        `json:"conditions" bson:"conditions"`
	Actions       []RuleAction           `json:"actions" bson:"actions"`
	IsActive      bool                   `json:"is_active" bson:"is_active"`
	Schedule      string                 `json:"schedule,omitempty" bson:"schedule,omitempty"`
	LastTriggered *time.Time             `json:"last_triggered,omitempty" bson:"last_triggered,omitempty"`
	TriggerCount  int64                  `json:"trigger_count" bson:"trigger_count"`
	Metadata      map[string]interface{} `json:"metadata,omitempty" bson:"metadata,omitempty"`
	CreatedAt     time.Time              `json:"created_at" bson:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at" bson:"updated_at"`
}

type UserPreference struct {
	ID              string    `json:"id" bson:"_id"`
	UserID          string    `json:"user_id" bson:"user_id"`
	Channel         string    `json:"channel" bson:"channel"`
	Category        string    `json:"category" bson:"category"`
	Enabled         bool      `json:"enabled" bson:"enabled"`
	QuietHoursStart string    `json:"quiet_hours_start,omitempty" bson:"quiet_hours_start,omitempty"`
	QuietHoursEnd   string    `json:"quiet_hours_end,omitempty" bson:"quiet_hours_end,omitempty"`
	UpdatedAt       time.Time `json:"updated_at" bson:"updated_at"`
}

type WebSocketConnection struct {
	ConnectionID string    `json:"connection_id" bson:"_id"`
	UserID       string    `json:"user_id" bson:"user_id"`
	ProjectIDs   []string  `json:"project_ids" bson:"project_ids"`
	ConnectedAt  time.Time `json:"connected_at" bson:"connected_at"`
	LastActivity time.Time `json:"last_activity" bson:"last_activity"`
	UserAgent    string    `json:"user_agent,omitempty" bson:"user_agent,omitempty"`
	IPAddress    string    `json:"ip_address,omitempty" bson:"ip_address,omitempty"`
}

type SendNotificationRequest struct {
	UserID       string                 `json:"user_id" binding:"required"`
	ProjectID    string                 `json:"project_id"`
	Category     string                 `json:"category" binding:"required"`
	TemplateID   string                 `json:"template_id"`
	Subject      string                 `json:"subject"`
	Content      string                 `json:"content"`
	Channels     []string               `json:"channels" binding:"required,min=1"`
	Variables    map[string]interface{} `json:"variables"`
	Metadata     map[string]interface{} `json:"metadata"`
	Destinations map[string]string      `json:"destinations"`
}

type UpdatePreferencesRequest struct {
	Category         string   `json:"category" binding:"required"`
	EnabledChannels  []string `json:"enabled_channels"`
	DisabledChannels []string `json:"disabled_channels"`
	QuietHoursStart  string   `json:"quiet_hours_start"`
	QuietHoursEnd    string   `json:"quiet_hours_end"`
}

type TemplatePreviewRequest struct {
	Variables map[string]interface{} `json:"variables"`
}

type RuleTestRequest struct {
	SampleData map[string]interface{} `json:"sample_data"`
}

type BroadcastRequest struct {
	ProjectID string                 `json:"project_id"`
	UserID    string                 `json:"user_id"`
	Message   string                 `json:"message" binding:"required"`
	Metadata  map[string]interface{} `json:"metadata"`
}

type DeliveryMetrics struct {
	TotalNotifications int64            `json:"total_notifications"`
	ByStatus           map[string]int64 `json:"by_status"`
	ByChannel          map[string]int64 `json:"by_channel"`
	Last24h            int64            `json:"last_24h"`
	GeneratedAt        time.Time        `json:"generated_at"`
}
