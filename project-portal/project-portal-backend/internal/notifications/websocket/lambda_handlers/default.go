package lambda_handlers

import (
	"context"
	"log"

	ws "carbon-scribe/project-portal/project-portal-backend/internal/notifications/websocket"
)

// DefaultHandler handles unexpected or custom route keys
type DefaultHandler struct{}

// NewDefaultHandler creates a new DefaultHandler instance
func NewDefaultHandler() *DefaultHandler {
	return &DefaultHandler{}
}

// Handle processes generic/default WebSocket frames
func (h *DefaultHandler) Handle(ctx context.Context, event ws.Event) (interface{}, error) {
	log.Printf("[Lambda Default] Received unhandled WebSocket event: RouteKey=%s, ConnectionID=%s, Body=%s",
		event.RouteKey, event.RequestContext.ConnectionID, event.Body)

	// In real-time apps, we can parse custom commands or echo back a response.
	return map[string]interface{}{
		"statusCode": 200,
		"body":       "Received default action",
	}, nil
}
