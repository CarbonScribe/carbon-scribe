package channels

import (
	"context"
	"fmt"
	"log"

	"carbon-scribe/project-portal/project-portal-backend/pkg/aws"
)

type SMSChannel struct {
	SNS *aws.SNSClient
}

func (c *SMSChannel) Send(ctx context.Context, recipient string, subject string, body string) (string, error) {
	if c.SNS != nil {
		return c.SNS.SendSMS(ctx, recipient, body)
	}
	log.Printf("[MOCK SNS] Sending SMS to %s\nMessage: %s", recipient, body)
	return fmt.Sprintf("sns-mock-%d", 789012), nil
}
