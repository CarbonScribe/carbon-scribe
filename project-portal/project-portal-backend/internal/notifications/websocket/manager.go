package websocket

import (
	"context"
	"fmt"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/pkg/aws"
)

// ConnectionManager manages real-time WebSocket connection state in DynamoDB
type ConnectionManager struct {
	ddbClient aws.DynamoDBClient
	ttlOffset time.Duration // Optional TTL for auto-expiring connection records (e.g. 24 hours)
}

// NewConnectionManager creates a new connection manager backed by DynamoDB
func NewConnectionManager(ddbClient aws.DynamoDBClient, ttlOffset time.Duration) *ConnectionManager {
	if ttlOffset == 0 {
		ttlOffset = 24 * time.Hour // Default auto-expire connection records after 24h
	}
	return &ConnectionManager{
		ddbClient: ddbClient,
		ttlOffset: ttlOffset,
	}
}

// Connect registers a new WebSocket connection in DynamoDB
func (m *ConnectionManager) Connect(ctx context.Context, connectionID, userID string, projectIDs []string, userAgent, ipAddress string) error {
	if connectionID == "" {
		return fmt.Errorf("connectionID is required")
	}
	if userID == "" {
		return fmt.Errorf("userID is required")
	}

	now := time.Now().UTC()
	record := &aws.ConnectionRecord{
		ConnectionID: connectionID,
		UserID:       userID,
		ProjectIDs:   projectIDs,
		ConnectedAt:  now,
		LastActivity: now,
		UserAgent:    userAgent,
		IPAddress:    ipAddress,
		TTL:          now.Add(m.ttlOffset).Unix(),
	}

	return m.ddbClient.PutConnection(ctx, record)
}

// Disconnect removes a WebSocket connection from DynamoDB
func (m *ConnectionManager) Disconnect(ctx context.Context, connectionID string) error {
	if connectionID == "" {
		return fmt.Errorf("connectionID is required")
	}
	return m.ddbClient.DeleteConnection(ctx, connectionID)
}

// GetConnection retrieves a specific connection record
func (m *ConnectionManager) GetConnection(ctx context.Context, connectionID string) (*aws.ConnectionRecord, error) {
	if connectionID == "" {
		return nil, fmt.Errorf("connectionID is required")
	}
	return m.ddbClient.GetConnection(ctx, connectionID)
}

// GetActiveConnectionsByUser retrieves all active connections for a user
func (m *ConnectionManager) GetActiveConnectionsByUser(ctx context.Context, userID string) ([]aws.ConnectionRecord, error) {
	if userID == "" {
		return nil, fmt.Errorf("userID is required")
	}
	return m.ddbClient.ListConnectionsByUser(ctx, userID)
}

// GetActiveConnectionsByProject retrieves all active connections for a project
func (m *ConnectionManager) GetActiveConnectionsByProject(ctx context.Context, projectID string) ([]aws.ConnectionRecord, error) {
	if projectID == "" {
		return nil, fmt.Errorf("projectID is required")
	}
	return m.ddbClient.ListConnectionsByProject(ctx, projectID)
}
