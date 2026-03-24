package notifications

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// NotificationTemplate represents an email/sms template
type NotificationTemplate struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id" dynamodbav:"id"`
	Type      string             `bson:"type" json:"type" dynamodbav:"type"`
	Language  string             `bson:"language" json:"language" dynamodbav:"language"`
	Version   int                `bson:"version" json:"version" dynamodbav:"version"`
	Name      string             `bson:"name" json:"name" dynamodbav:"name"`
	Subject   string             `bson:"subject" json:"subject" dynamodbav:"subject"`
	Body      string             `bson:"body" json:"body" dynamodbav:"body"`
	Variables []string           `bson:"variables" json:"variables" dynamodbav:"variables"`
	Metadata  map[string]any     `bson:"metadata" json:"metadata" dynamodbav:"metadata"`
	IsActive  bool               `bson:"isActive" json:"isActive" dynamodbav:"isActive"`
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt" dynamodbav:"createdAt"`
}

// NotificationRule represents an alert rule
type NotificationRule struct {
	ID            primitive.ObjectID       `bson:"_id,omitempty" json:"id" dynamodbav:"id"`
	ProjectID     string                   `bson:"projectId" json:"projectId" dynamodbav:"projectId"`
	Name          string                   `bson:"name" json:"name" dynamodbav:"name"`
	Description   string                   `bson:"description" json:"description" dynamodbav:"description"`
	Conditions    []map[string]interface{} `bson:"conditions" json:"conditions" dynamodbav:"conditions"`
	Actions       []map[string]interface{} `bson:"actions" json:"actions" dynamodbav:"actions"`
	IsActive      bool                     `bson:"isActive" json:"isActive" dynamodbav:"isActive"`
	LastTriggered time.Time                `bson:"lastTriggered,omitempty" json:"lastTriggered,omitempty" dynamodbav:"lastTriggered,omitempty"`
	TriggerCount  int                      `bson:"triggerCount" json:"triggerCount" dynamodbav:"triggerCount"`
	Metadata      map[string]interface{}   `bson:"metadata" json:"metadata" dynamodbav:"metadata"`
}

// UserPreference stores notification choices per user
type UserPreference struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id" dynamodbav:"id"`
	UserID          string             `bson:"userId" json:"userId" dynamodbav:"userId"`
	Channel         string             `bson:"channel" json:"channel" dynamodbav:"channel"`
	Category        string             `bson:"category" json:"category" dynamodbav:"category"`
	Enabled         bool               `bson:"enabled" json:"enabled" dynamodbav:"enabled"`
	QuietHoursStart string             `bson:"quietHoursStart,omitempty" json:"quietHoursStart,omitempty" dynamodbav:"quietHoursStart,omitempty"`
	QuietHoursEnd   string             `bson:"quietHoursEnd,omitempty" json:"quietHoursEnd,omitempty" dynamodbav:"quietHoursEnd,omitempty"`
	Channels        []string           `bson:"channels" json:"channels" dynamodbav:"channels"`
	UpdatedAt       time.Time          `bson:"updatedAt" json:"updatedAt" dynamodbav:"updatedAt"`
}

// WebSocketConnection handles WS connection metadata
type WebSocketConnection struct {
	ID           string    `bson:"_id" json:"connectionId" dynamodbav:"id"`
	UserID       string    `bson:"userId" json:"userId" dynamodbav:"userId"`
	ProjectIDs   []string  `bson:"projectIds" json:"projectIds" dynamodbav:"projectIds"`
	ConnectedAt  time.Time `bson:"connectedAt" json:"connectedAt" dynamodbav:"connectedAt"`
	LastActivity time.Time `bson:"lastActivity" json:"lastActivity" dynamodbav:"lastActivity"`
	UserAgent    string    `bson:"userAgent" json:"userAgent" dynamodbav:"userAgent"`
	IPAddress    string    `bson:"ipAddress" json:"ipAddress" dynamodbav:"ipAddress"`
}

// DeliveryLog tracks notification sends
type DeliveryLog struct {
	ID                primitive.ObjectID     `bson:"_id,omitempty" json:"id" dynamodbav:"id"`
	NotificationID    string                 `bson:"notificationId" json:"notificationId" dynamodbav:"notificationId"`
	UserID            string                 `bson:"userId" json:"userId" dynamodbav:"userId"`
	Channel           string                 `bson:"channel" json:"channel" dynamodbav:"channel"`
	TemplateID        string                 `bson:"templateId" json:"templateId" dynamodbav:"templateId"`
	Status            string                 `bson:"status" json:"status" dynamodbav:"status"`
	ProviderMessageID string                 `bson:"providerMessageId,omitempty" json:"providerMessageId,omitempty" dynamodbav:"providerMessageId,omitempty"`
	ProviderResponse  map[string]interface{} `bson:"providerResponse,omitempty" json:"providerResponse,omitempty" dynamodbav:"providerResponse,omitempty"`
	RetryCount        int                    `bson:"retryCount" json:"retryCount" dynamodbav:"retryCount"`
	FinalStatus       string                 `bson:"finalStatus" json:"finalStatus" dynamodbav:"finalStatus"`
	Timestamp         time.Time              `bson:"timestamp" json:"timestamp" dynamodbav:"timestamp"`
}

// NotificationRequest represents an external request to send a notification
type NotificationRequest struct {
	UserID     string                 `json:"userId" binding:"required"`
	Channel    string                 `json:"channel" binding:"required"` // EMAIL, SMS, WS
	TemplateID string                 `json:"templateId" binding:"required"`
	Data       map[string]interface{} `json:"data"`
}
