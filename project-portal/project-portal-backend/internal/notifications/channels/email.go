package channels

import (
	"context"
	"fmt"
	"log"
)

type EmailChannel struct{}

func (c *EmailChannel) Send(ctx context.Context, recipient string, subject string, body string) (string, error) {
	log.Printf("[MOCK SES] Sending Email to %s\nSubject: %s\nBody: %s", recipient, subject, body)
	return fmt.Sprintf("ses-%d", 123456), nil
}
