package lambda_handlers

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"

	ws "carbon-scribe/project-portal/project-portal-backend/internal/notifications/websocket"
)

// TokenValidator defines an interface for validating JWT auth tokens
type TokenValidator interface {
	ValidateToken(token string) (userID string, projectIDs []string, err error)
}

// ConnectHandler creates a handler to process the $connect WebSocket event from API Gateway
type ConnectHandler struct {
	manager   *ws.ConnectionManager
	validator TokenValidator
}

// NewConnectHandler creates a new ConnectHandler instance
func NewConnectHandler(manager *ws.ConnectionManager, validator TokenValidator) *ConnectHandler {
	return &ConnectHandler{
		manager:   manager,
		validator: validator,
	}
}

// Handle processes the $connect request
func (h *ConnectHandler) Handle(ctx context.Context, event ws.Event) (interface{}, error) {
	connectionID := event.RequestContext.ConnectionID
	if connectionID == "" {
		connectionID = event.ConnectionID
	}
	if connectionID == "" {
		return nil, errors.New("missing connection ID")
	}

	log.Printf("[Lambda Connect] Processing connection request: ConnectionID=%s", connectionID)

	// Extract token from multiple sources: QueryString, Headers, Sec-WebSocket-Protocol
	var token string
	if event.QueryString != nil {
		token = event.QueryString["token"]
	}
	if token == "" && event.Headers != nil {
		token = event.Headers["Authorization"]
		if strings.HasPrefix(strings.ToLower(token), "bearer ") {
			token = token[7:]
		}
	}
	if token == "" && event.Headers != nil {
		// API Gateway sometimes passes auth token via Sec-WebSocket-Protocol header
		token = event.Headers["Sec-WebSocket-Protocol"]
	}

	// Validate authorization
	var userID string
	var projectIDs []string
	var err error

	if h.validator != nil && token != "" {
		userID, projectIDs, err = h.validator.ValidateToken(token)
		if err != nil {
			log.Printf("[Lambda Connect] Authorization failed for token: %v", err)
			return nil, fmt.Errorf("unauthorized: %w", err)
		}
	} else {
		// Fallback/Dev mode if no validator is configured
		userID = event.UserID
		if userID == "" {
			userID = "dev-user-id" // Default fallback for development
		}
		projectIDs = []string{"all-projects"}
		log.Printf("[Lambda Connect] Dev/Fallback mode: using default UserID=%s", userID)
	}

	userAgent := event.RequestContext.Identity.SourceAgent
	ipAddress := event.RequestContext.Identity.SourceIP

	// Store connection state in DynamoDB
	err = h.manager.Connect(ctx, connectionID, userID, projectIDs, userAgent, ipAddress)
	if err != nil {
		log.Printf("[Lambda Connect] Failed to save connection in DynamoDB: %v", err)
		return nil, fmt.Errorf("failed to save connection state: %w", err)
	}

	log.Printf("[Lambda Connect] Connection registered successfully: ConnectionID=%s, UserID=%s", connectionID, userID)
	return map[string]interface{}{
		"statusCode": 200,
		"body":       "Connected",
	}, nil
}
