package channels

import (
	"context"
	"fmt"
	"log"

	"carbon-scribe/project-portal/project-portal-backend/pkg/aws"
)

type EmailChannel struct {
	SES  *aws.SESClient
	From string
}

func (c *EmailChannel) Send(ctx context.Context, recipient string, subject string, body string) (string, error) {
	if c.SES != nil {
		return c.SES.SendEmail(ctx, c.From, recipient, subject, body)
	}
	log.Printf("[MOCK SES] Sending Email to %s\nSubject: %s\nBody: %s", recipient, subject, body)
	return fmt.Sprintf("ses-mock-%d", 123456), nil
}
