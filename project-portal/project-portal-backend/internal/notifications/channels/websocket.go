package channels

import (
	"context"
	"fmt"
	"log"
)

// WSManager interface to avoid circular dependency
type WSManager interface {
	SendMessage(userID string, message []byte) error
}

type WebSocketChannel struct {
	Manager WSManager
}

func (c *WebSocketChannel) Send(ctx context.Context, recipient string, subject string, body string) (string, error) {
	log.Printf("[MOCK WS] Sending live update to user %s: %s", recipient, body)
	if c.Manager != nil {
		msg := fmt.Sprintf(`{"subject":"%s", "body":"%s"}`, subject, body)
		err := c.Manager.SendMessage(recipient, []byte(msg))
		return "ws-msg-id", err
	}
	return "ws-msg-id", nil
}
