package channels

import (
	"context"
	"errors"
	"fmt"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/pkg/aws"
)

// WebSocketConnection mirrors the type from notifications package to avoid import cycle
type WebSocketConnection struct {
	ConnectionID string    `json:"connection_id" bson:"_id"`
	UserID       string    `json:"user_id" bson:"user_id"`
	ProjectIDs   []string  `json:"project_ids" bson:"project_ids"`
	ConnectedAt  time.Time `json:"connected_at" bson:"connected_at"`
	LastActivity time.Time `json:"last_activity" bson:"last_activity"`
	UserAgent    string    `json:"user_agent,omitempty" bson:"user_agent,omitempty"`
	IPAddress    string    `json:"ip_address,omitempty" bson:"ip_address,omitempty"`
}

// WebSocketNotification mirrors the type from notifications package to avoid import cycle
type WebSocketNotification struct {
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

// WebSocketRepo defines the minimal interface needed from the repository to avoid import cycle
type WebSocketRepo interface {
	ListConnections(ctx context.Context, projectID string, userID string) ([]WebSocketConnection, error)
}

// WebSocketSender defines the interface for sending WebSocket notifications.
type WebSocketSender interface {
	Send(ctx context.Context, userID string, notification *WebSocketNotification) error
	Broadcast(ctx context.Context, projectID string, notification *WebSocketNotification) (int, error)
}

// WebSocketChannel implements WebSocket notification delivery.
type WebSocketChannel struct {
	repo       WebSocketRepo
	apiClient  *aws.APIGatewayClient
	retryLimit int
}

// NewWebSocketChannel creates a new WebSocket notification channel.
func NewWebSocketChannel(repo WebSocketRepo, apiClient *aws.APIGatewayClient) *WebSocketChannel {
	return &WebSocketChannel{
		repo:       repo,
		apiClient:  apiClient,
		retryLimit: 3,
	}
}

// Send sends a notification to all active WebSocket connections for a user.
func (w *WebSocketChannel) Send(ctx context.Context, userID string, notification *WebSocketNotification) error {
	if userID == "" {
		return errors.New("user ID is required")
	}
	if notification == nil {
		return errors.New("notification is required")
	}

	conns, err := w.repo.ListConnections(ctx, "", userID)
	if err != nil {
		return fmt.Errorf("failed to list connections: %w", err)
	}

	if len(conns) == 0 {
		return fmt.Errorf("no active connections for user %s", userID)
	}

	var lastErr error
	sentCount := 0

	for _, conn := range conns {
		for attempt := 0; attempt <= w.retryLimit; attempt++ {
			err := w.sendToConnection(ctx, conn.ConnectionID, notification)
			if err == nil {
				sentCount++
				break
			}
			lastErr = err
			if attempt < w.retryLimit {
				time.Sleep(time.Duration((attempt + 1) * 100) * time.Millisecond)
			}
		}
	}

	if sentCount == 0 && lastErr != nil {
		return lastErr
	}

	return nil
}

// Broadcast sends a notification to all connections in a project.
func (w *WebSocketChannel) Broadcast(ctx context.Context, projectID string, notification *WebSocketNotification) (int, error) {
	if projectID == "" {
		return 0, errors.New("project ID is required")
	}
	if notification == nil {
		return 0, errors.New("notification is required")
	}

	conns, err := w.repo.ListConnections(ctx, projectID, "")
	if err != nil {
		return 0, fmt.Errorf("failed to list connections: %w", err)
	}

	sentCount := 0
	for _, conn := range conns {
		for attempt := 0; attempt <= w.retryLimit; attempt++ {
			err := w.sendToConnection(ctx, conn.ConnectionID, notification)
			if err == nil {
				sentCount++
				break
			}
			if attempt < w.retryLimit {
				time.Sleep(time.Duration((attempt + 1) * 100) * time.Millisecond)
			}
		}
	}

	return sentCount, nil
}

// sendToConnection sends a notification to a single WebSocket connection.
func (w *WebSocketChannel) sendToConnection(ctx context.Context, connectionID string, notification *WebSocketNotification) error {
	if w.apiClient != nil {
		return w.apiClient.PostToConnection(ctx, connectionID, notification)
	}
	// If no API client (local dev), just return success (mock delivery)
	return nil
}
