package channels

import (
	"context"
	"fmt"
	"log"
)

type SMSChannel struct{}

func (c *SMSChannel) Send(ctx context.Context, recipient string, subject string, body string) (string, error) {
	log.Printf("[MOCK SNS] Sending SMS to %s\nMessage: %s", recipient, body)
	return fmt.Sprintf("sns-%d", 789012), nil
}
