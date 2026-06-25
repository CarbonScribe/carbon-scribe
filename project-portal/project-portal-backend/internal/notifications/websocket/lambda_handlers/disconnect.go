package lambda_handlers

import (
	"context"
	"errors"
	"log"

	ws "carbon-scribe/project-portal/project-portal-backend/internal/notifications/websocket"
)

// DisconnectHandler creates a handler to process the $disconnect WebSocket event from API Gateway
type DisconnectHandler struct {
	manager *ws.ConnectionManager
}

// NewDisconnectHandler creates a new DisconnectHandler instance
func NewDisconnectHandler(manager *ws.ConnectionManager) *DisconnectHandler {
	return &DisconnectHandler{
		manager: manager,
	}
}

// Handle processes the $disconnect request
func (h *DisconnectHandler) Handle(ctx context.Context, event ws.Event) (interface{}, error) {
	connectionID := event.RequestContext.ConnectionID
	if connectionID == "" {
		connectionID = event.ConnectionID
	}
	if connectionID == "" {
		return nil, errors.New("missing connection ID")
	}

	log.Printf("[Lambda Disconnect] Processing disconnection request: ConnectionID=%s", connectionID)

	// Remove connection state from DynamoDB
	err := h.manager.Disconnect(ctx, connectionID)
	if err != nil {
		log.Printf("[Lambda Disconnect] Failed to remove connection from DynamoDB: %v", err)
		// We log the error but return success anyway since the client has already physically disconnected
	} else {
		log.Printf("[Lambda Disconnect] Connection removed successfully: ConnectionID=%s", connectionID)
	}

	return map[string]interface{}{
		"statusCode": 200,
		"body":       "Disconnected",
	}, nil
}
