package notifications

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// NotificationCategory represents notification categories
type NotificationCategory struct {
	ID              uuid.UUID `json:"id" bson:"_id"`
	Code            string    `json:"code" bson:"code"`
	Name            string    `json:"name" bson:"name"`
	Description     string    `json:"description" bson:"description"`
	DefaultChannels []string  `json:"default_channels" bson:"default_channels"`
	IsCritical      bool      `json:"is_critical" bson:"is_critical"`
	CreatedAt       time.Time `json:"created_at" bson:"created_at"`
}

// SentNotification represents a sent notification
type SentNotification struct {
	ID          uuid.UUID  `json:"id" bson:"_id"`
	UserID      uuid.UUID  `json:"user_id" bson:"user_id"`
	CategoryID  *uuid.UUID `json:"category_id" bson:"category_id"`
	Channel     string     `json:"channel" bson:"channel"`
	Subject     string     `json:"subject" bson:"subject"`
	Content     string     `json:"content" bson:"content"`
	Status      string     `json:"status" bson:"status"`
	ProviderID  *string    `json:"provider_id" bson:"provider_id"`
	SentAt      *time.Time `json:"sent_at" bson:"sent_at"`
	DeliveredAt *time.Time `json:"delivered_at" bson:"delivered_at"`
	OpenedAt    *time.Time `json:"opened_at" bson:"opened_at"`
}

// NotificationTemplate represents notification templates
type NotificationTemplate struct {
	ID        uuid.UUID      `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	Type      string         `json:"type" gorm:"not null"`
	Language  string         `json:"language" gorm:"not null"`
	Version   string         `json:"version" gorm:"not null"`
	Name      string         `json:"name" gorm:"not null"`
	Subject   string         `json:"subject" gorm:"not null"`
	Body      string         `json:"body" gorm:"not null"`
	Variables []string       `json:"variables" gorm:"type:text[]"`
	Metadata  datatypes.JSON `json:"metadata" gorm:"type:jsonb"`
	IsActive  bool           `json:"is_active" gorm:"default:true"`
	CreatedAt time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
}

// NotificationRule represents alert rules
type NotificationRule struct {
	ID            uuid.UUID      `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	ProjectID     string         `json:"project_id" gorm:"not null;index"`
	Name          string         `json:"name" gorm:"not null"`
	Description   string         `json:"description" gorm:""`
	Conditions    datatypes.JSON `json:"conditions" gorm:"type:jsonb"`
	Actions       datatypes.JSON `json:"actions" gorm:"type:jsonb"`
	IsActive      bool           `json:"is_active" gorm:"default:true"`
	LastTriggered *time.Time     `json:"last_triggered" gorm:""`
	TriggerCount  int            `json:"trigger_count" gorm:"default:0"`
	Metadata      datatypes.JSON `json:"metadata" gorm:"type:jsonb"`
	CreatedAt     time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
}

// RuleCondition represents a rule condition
type RuleCondition struct {
	Type     string         `json:"type"` // threshold, rate_change, pattern
	Field    string         `json:"field"`
	Operator string         `json:"operator"` // gt, lt, eq, gte, lte, contains
	Value    interface{}    `json:"value"`
	Metadata datatypes.JSON `json:"metadata" gorm:"type:jsonb"`
}

// RuleAction represents a rule action
type RuleAction struct {
	Type       string         `json:"type"` // email, sms, websocket, in_app
	TemplateID string         `json:"template_id"`
	Recipients []string       `json:"recipients"`
	Metadata   datatypes.JSON `json:"metadata" gorm:"type:jsonb"`
}

// UserPreference represents user notification preferences
type UserPreference struct {
	ID              uuid.UUID      `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	UserID          string         `json:"user_id" gorm:"not null;index"`
	Channel         string         `json:"channel" gorm:"not null"`
	Category        string         `json:"category" gorm:"not null"`
	Enabled         bool           `json:"enabled" gorm:"default:true"`
	QuietHoursStart string         `json:"quiet_hours_start" gorm:""`
	QuietHoursEnd   string         `json:"quiet_hours_end" gorm:""`
	Channels        datatypes.JSON `json:"channels" gorm:"type:jsonb"`
	UpdatedAt       time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
}

// WebSocketConnection represents WebSocket connection metadata
type WebSocketConnection struct {
	ID           uuid.UUID      `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	ConnectionID string         `json:"connection_id" gorm:"not null;uniqueIndex"`
	UserID       string         `json:"user_id" gorm:"not null;index"`
	ProjectIDs   datatypes.JSON `json:"project_ids" gorm:"type:jsonb"`
	ConnectedAt  time.Time      `json:"connected_at" gorm:"autoCreateTime"`
	LastActivity time.Time      `json:"last_activity" gorm:"autoUpdateTime"`
	UserAgent    string         `json:"user_agent" gorm:""`
	IPAddress    string         `json:"ip_address" gorm:""`
}

// DeliveryLog represents delivery tracking logs
type DeliveryLog struct {
	ID                uuid.UUID      `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	NotificationID    string         `json:"notification_id" gorm:"not null;index"`
	UserID            string         `json:"user_id" gorm:"not null;index"`
	Channel           string         `json:"channel" gorm:"not null"`
	TemplateID        string         `json:"template_id" gorm:""`
	Status            string         `json:"status" gorm:"not null"`
	ProviderMessageID string         `json:"provider_message_id" gorm:""`
	ProviderResponse  datatypes.JSON `json:"provider_response" gorm:"type:jsonb"`
	RetryCount        int            `json:"retry_count" gorm:"default:0"`
	FinalStatus       string         `json:"final_status" gorm:""`
	Timestamp         time.Time      `json:"timestamp" gorm:"autoCreateTime"`
}

// WebSocketMessage represents WebSocket message format
type WebSocketMessage struct {
	Type      string         `json:"type"`
	Data      datatypes.JSON `json:"data" gorm:"type:jsonb"`
	Timestamp time.Time      `json:"timestamp"`
	Channel   string         `json:"channel"`
	Target    string         `json:"target"` // user_id or project_id
	Source    string         `json:"source"` // source user_id
}

// NotificationRequest represents a notification sending request
type NotificationRequest struct {
	UserID      uuid.UUID              `json:"user_id" gorm:"type:uuid"`
	Category    string                 `json:"category" gorm:"not null"`
	Channels    []string               `json:"channels" gorm:"type:text[]"`
	Subject     string                 `json:"subject" gorm:"not null"`
	Content     string                 `json:"content" gorm:"not null"`
	Metadata    map[string]interface{} `json:"metadata" gorm:"type:jsonb"`
	Priority    string                 `json:"priority" gorm:"not null"` // low, normal, high, critical
	ScheduledAt *time.Time             `json:"scheduled_at" gorm:""`
}

// NotificationResponse represents notification sending response
type NotificationResponse struct {
	NotificationID uuid.UUID                        `json:"notification_id" gorm:"type:uuid"`
	Status         string                           `json:"status"`
	Message        string                           `json:"message"`
	DeliveryStatus map[string]ChannelDeliveryStatus `json:"delivery_status"`
}

// ChannelDeliveryStatus represents delivery status per channel
type ChannelDeliveryStatus struct {
	Channel      string     `json:"channel"`
	Status       string     `json:"status"`
	ProviderID   *string    `json:"provider_id"`
	ErrorMessage *string    `json:"error_message"`
	SentAt       *time.Time `json:"sent_at"`
	DeliveredAt  *time.Time `json:"delivered_at"`
}

// RuleTestRequest represents rule testing request
type RuleTestRequest struct {
	RuleID      uuid.UUID      `json:"rule_id" gorm:"type:uuid"`
	TestData    datatypes.JSON `json:"test_data" gorm:"type:jsonb"`
	TestContext datatypes.JSON `json:"test_context" gorm:"type:jsonb"`
}

// RuleTestResponse represents rule testing response
type RuleTestResponse struct {
	RuleID        uuid.UUID      `json:"rule_id" gorm:"type:uuid"`
	Triggered     bool           `json:"triggered"`
	Evaluations   datatypes.JSON `json:"evaluations" gorm:"type:jsonb"`
	Actions       datatypes.JSON `json:"actions" gorm:"type:jsonb"`
	ExecutionTime time.Duration  `json:"execution_time"`
}

// ConditionEvaluation represents condition evaluation result
type ConditionEvaluation struct {
	ConditionIndex int           `json:"condition_index"`
	Condition      RuleCondition `json:"condition"`
	Result         bool          `json:"result"`
	Message        string        `json:"message"`
	ExecutionTime  time.Duration `json:"execution_time"`
}

// TemplatePreviewRequest represents template preview request
type TemplatePreviewRequest struct {
	TemplateID uuid.UUID      `json:"template_id" gorm:"type:uuid"`
	Variables  datatypes.JSON `json:"variables" gorm:"type:jsonb"`
}

// TemplatePreviewResponse represents template preview response
type TemplatePreviewResponse struct {
	TemplateID       uuid.UUID      `json:"template_id" gorm:"type:uuid"`
	RenderedSubject  string         `json:"rendered_subject"`
	RenderedBody     string         `json:"rendered_body"`
	Variables        datatypes.JSON `json:"variables" gorm:"type:jsonb"`
	MissingVariables datatypes.JSON `json:"missing_variables" gorm:"type:jsonb"`
}

// NotificationMetrics represents notification delivery metrics
type NotificationMetrics struct {
	Period          string                     `json:"period"`
	TotalSent       int64                      `json:"total_sent"`
	TotalDelivered  int64                      `json:"total_delivered"`
	TotalFailed     int64                      `json:"total_failed"`
	ChannelMetrics  map[string]ChannelMetrics  `json:"channel_metrics"`
	CategoryMetrics map[string]CategoryMetrics `json:"category_metrics"`
	DeliveryRate    float64                    `json:"delivery_rate"`
	AverageLatency  time.Duration              `json:"average_latency"`
}

// ChannelMetrics represents metrics per channel
type ChannelMetrics struct {
	Sent      int64         `json:"sent" bson:"sent"`
	Delivered int64         `json:"delivered" bson:"delivered"`
	Failed    int64         `json:"failed" bson:"failed"`
	Rate      float64       `json:"rate" bson:"rate"`
	Latency   time.Duration `json:"latency" bson:"latency"`
}

// CategoryMetrics represents metrics per category
type CategoryMetrics struct {
	Sent      int64   `json:"sent" bson:"sent"`
	Delivered int64   `json:"delivered" bson:"delivered"`
	Failed    int64   `json:"failed" bson:"failed"`
	Rate      float64 `json:"rate" bson:"rate"`
}

// Constants
const (
	// Notification channels
	ChannelEmail     = "EMAIL"
	ChannelSMS       = "SMS"
	ChannelWebSocket = "WEBSOCKET"
	ChannelInApp     = "IN_APP"
	ChannelPush      = "PUSH"

	// Notification statuses
	StatusPending    = "PENDING"
	StatusSent       = "SENT"
	StatusDelivered  = "DELIVERED"
	StatusFailed     = "FAILED"
	StatusBounced    = "BOUNCED"
	StatusComplained = "COMPLAINED"

	// Rule condition types
	ConditionThreshold  = "threshold"
	ConditionRateChange = "rate_change"
	ConditionPattern    = "pattern"

	// Rule operators
	OperatorGT       = "gt"
	OperatorLT       = "lt"
	OperatorEQ       = "eq"
	OperatorGTE      = "gte"
	OperatorLTE      = "lte"
	OperatorContains = "contains"

	// Notification priorities
	PriorityLow      = "low"
	PriorityNormal   = "normal"
	PriorityHigh     = "high"
	PriorityCritical = "critical"

	// WebSocket message types
	WSMessageTypeNotification = "notification"
	WSMessageTypeStatus       = "status"
	WSMessageTypePresence     = "presence"
	WSMessageTypeBroadcast    = "broadcast"
	WSMessageTypePrivate      = "private"
)

// Default notification categories
var DefaultCategories = []NotificationCategory{
	{
		Code:            "MONITORING_ALERTS",
		Name:            "Monitoring Alerts",
		Description:     "Alerts related to project monitoring and data collection",
		DefaultChannels: []string{ChannelEmail, ChannelWebSocket},
		IsCritical:      true,
	},
	{
		Code:            "PAYMENT_UPDATES",
		Name:            "Payment Updates",
		Description:     "Notifications about payment processing and revenue distribution",
		DefaultChannels: []string{ChannelEmail, ChannelInApp},
		IsCritical:      false,
	},
	{
		Code:            "SYSTEM_ANNOUNCEMENTS",
		Name:            "System Announcements",
		Description:     "Platform-wide announcements and maintenance notices",
		DefaultChannels: []string{ChannelEmail, ChannelWebSocket},
		IsCritical:      false,
	},
	{
		Code:            "PROJECT_UPDATES",
		Name:            "Project Updates",
		Description:     "Updates specific to project activities and milestones",
		DefaultChannels: []string{ChannelEmail, ChannelInApp, ChannelWebSocket},
		IsCritical:      false,
	},
}
