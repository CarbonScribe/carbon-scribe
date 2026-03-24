package channels

import (
	"context"
	"fmt"
	"log"

	"carbon-scribe/project-portal/project-portal-backend/pkg/aws"
)

// Repository interface to avoid circular dependency
type Repository interface {
	GetConnectionIDsByUser(ctx context.Context, userID string) ([]string, error)
}

// Model placeholder to avoid circular dep if needed, but we can probably use the models package
// Actually, let's just use the interface as defined or see if we can import models.

// WSManager interface to avoid circular dependency
type WSManager interface {
	SendMessage(userID string, message []byte) error
}

type WebSocketChannel struct {
	Manager WSManager
	APIGW   *aws.APIGatewayClient
	Repo    Repository
}

func (c *WebSocketChannel) Send(ctx context.Context, recipient string, subject string, body string) (string, error) {
	msg := fmt.Sprintf(`{"subject":"%s", "body":"%s"}`, subject, body)

	// If AWS API Gateway is configured, push to all active connection IDs
	if c.APIGW != nil && c.Repo != nil {
		connIDs, err := c.Repo.GetConnectionIDsByUser(ctx, recipient)
		if err == nil {
			for _, connID := range connIDs {
				log.Printf("[AWS APIGW] Pushing to connection %s for user %s", connID, recipient)
				// Data must be []byte
				_ = c.APIGW.PostToConnection(ctx, connID, []byte(msg))
			}
		}
	}

	if c.Manager != nil {
		log.Printf("[MOCK WS] Sending live update to user %s: %s", recipient, body)
		err := c.Manager.SendMessage(recipient, []byte(msg))
		return "ws-msg-id", err
	}
	return "ws-msg-id", nil
}
