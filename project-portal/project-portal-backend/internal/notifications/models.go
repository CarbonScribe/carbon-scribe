package notifications

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// NotificationTemplate represents an email/sms template
type NotificationTemplate struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Type      string             `bson:"type" json:"type"`         // e.g. "MONITORING_ALERT"
	Language  string             `bson:"language" json:"language"` // e.g. "en"
	Version   int                `bson:"version" json:"version"`
	Name      string             `bson:"name" json:"name"`
	Subject   string             `bson:"subject" json:"subject"` // For emails
	Body      string             `bson:"body" json:"body"`       // HTML or text
	Variables []string           `bson:"variables" json:"variables"`
	Metadata  map[string]any     `bson:"metadata" json:"metadata"`
	IsActive  bool               `bson:"isActive" json:"isActive"`
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
}

// NotificationRule represents an alert rule
type NotificationRule struct {
	ID            primitive.ObjectID       `bson:"_id,omitempty" json:"id"`
	ProjectID     string                   `bson:"projectId" json:"projectId"`
	Name          string                   `bson:"name" json:"name"`
	Description   string                   `bson:"description" json:"description"`
	Conditions    []map[string]interface{} `bson:"conditions" json:"conditions"`
	Actions       []map[string]interface{} `bson:"actions" json:"actions"`
	IsActive      bool                     `bson:"isActive" json:"isActive"`
	LastTriggered time.Time                `bson:"lastTriggered,omitempty" json:"lastTriggered,omitempty"`
	TriggerCount  int                      `bson:"triggerCount" json:"triggerCount"`
	Metadata      map[string]interface{}   `bson:"metadata" json:"metadata"`
}

// UserPreference stores notification choices per user
type UserPreference struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID          string             `bson:"userId" json:"userId"`
	Channel         string             `bson:"channel" json:"channel"`   // e.g. EMAIL, SMS, WS
	Category        string             `bson:"category" json:"category"` // e.g. MONITORING_ALERTS
	Enabled         bool               `bson:"enabled" json:"enabled"`
	QuietHoursStart string             `bson:"quietHoursStart,omitempty" json:"quietHoursStart,omitempty"` // e.g., "22:00"
	QuietHoursEnd   string             `bson:"quietHoursEnd,omitempty" json:"quietHoursEnd,omitempty"`     // e.g., "08:00"
	Channels        []string           `bson:"channels" json:"channels"`                                   // List of channels enabled
	UpdatedAt       time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// WebSocketConnection handles WS connection metadata
type WebSocketConnection struct {
	ID           string    `bson:"_id" json:"connectionId"` // Storing the WS connection ID
	UserID       string    `bson:"userId" json:"userId"`
	ProjectIDs   []string  `bson:"projectIds" json:"projectIds"`
	ConnectedAt  time.Time `bson:"connectedAt" json:"connectedAt"`
	LastActivity time.Time `bson:"lastActivity" json:"lastActivity"`
	UserAgent    string    `bson:"userAgent" json:"userAgent"`
	IPAddress    string    `bson:"ipAddress" json:"ipAddress"`
}

// DeliveryLog tracks notification sends
type DeliveryLog struct {
	ID                primitive.ObjectID     `bson:"_id,omitempty" json:"id"`
	NotificationID    string                 `bson:"notificationId" json:"notificationId"`
	UserID            string                 `bson:"userId" json:"userId"`
	Channel           string                 `bson:"channel" json:"channel"`
	TemplateID        string                 `bson:"templateId" json:"templateId"`
	Status            string                 `bson:"status" json:"status"` // PENDING, SENT, DELIVERED, FAILED
	ProviderMessageID string                 `bson:"providerMessageId,omitempty" json:"providerMessageId,omitempty"`
	ProviderResponse  map[string]interface{} `bson:"providerResponse,omitempty" json:"providerResponse,omitempty"`
	RetryCount        int                    `bson:"retryCount" json:"retryCount"`
	FinalStatus       string                 `bson:"finalStatus" json:"finalStatus"`
	Timestamp         time.Time              `bson:"timestamp" json:"timestamp"`
}

// NotificationRequest represents an external request to send a notification
type NotificationRequest struct {
	UserID     string                 `json:"userId" binding:"required"`
	Channel    string                 `json:"channel" binding:"required"` // EMAIL, SMS, WS
	TemplateID string                 `json:"templateId" binding:"required"`
	Data       map[string]interface{} `json:"data"`
}
