package notifications

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/smtp"
	"os"
	"regexp"
	"strings"
	"time"
)

// EmailChannel sends transactional and alert emails via SMTP or AWS SES (SMTP interface).
// Configuration is read from environment variables:
//
//	EMAIL_SMTP_HOST     - SMTP host (default: email-smtp.us-east-1.amazonaws.com)
//	EMAIL_SMTP_PORT     - SMTP port (default: 587)
//	EMAIL_SMTP_USER     - SMTP username / AWS SES SMTP user
//	EMAIL_SMTP_PASSWORD - SMTP password / AWS SES SMTP password
//	EMAIL_FROM_ADDRESS  - Sender address (default: noreply@carbonscribe.io)
//	EMAIL_FROM_NAME     - Sender display name (default: CarbonScribe)
type EmailChannel struct {
	host     string
	port     string
	user     string
	password string
	from     string
	fromName string
	maxRetry int
}

// EmailMessage is the payload passed to Send.
type EmailMessage struct {
	To      string
	Subject string
	Body    string // plain-text or HTML body
}

var emailRegexp = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

// NewEmailChannel constructs an EmailChannel from environment variables.
func NewEmailChannel() *EmailChannel {
	host := getEnvOrDefault("EMAIL_SMTP_HOST", "email-smtp.us-east-1.amazonaws.com")
	port := getEnvOrDefault("EMAIL_SMTP_PORT", "587")
	user := os.Getenv("EMAIL_SMTP_USER")
	password := os.Getenv("EMAIL_SMTP_PASSWORD")
	from := getEnvOrDefault("EMAIL_FROM_ADDRESS", "noreply@carbonscribe.io")
	fromName := getEnvOrDefault("EMAIL_FROM_NAME", "CarbonScribe")

	return &EmailChannel{
		host:     host,
		port:     port,
		user:     user,
		password: password,
		from:     from,
		fromName: fromName,
		maxRetry: 3,
	}
}

// Send delivers an email with retry logic. ctx is honoured between retries.
func (c *EmailChannel) Send(ctx context.Context, msg EmailMessage) error {
	if err := c.validate(msg); err != nil {
		return fmt.Errorf("email validation: %w", err)
	}

	raw := c.buildRaw(msg)
	addr := c.host + ":" + c.port

	var lastErr error
	for attempt := 1; attempt <= c.maxRetry; attempt++ {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		if err := c.sendSMTP(addr, raw, msg.To); err != nil {
			lastErr = err
			log.Printf("[EmailChannel] attempt %d/%d failed for %s: %v", attempt, c.maxRetry, msg.To, err)
			if attempt < c.maxRetry {
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-time.After(time.Duration(attempt) * 2 * time.Second):
				}
			}
			continue
		}

		log.Printf("[EmailChannel] email delivered to %s (attempt %d)", msg.To, attempt)
		return nil
	}

	return fmt.Errorf("email delivery failed after %d attempts: %w", c.maxRetry, lastErr)
}

// sendSMTP performs the actual SMTP dial and send.
func (c *EmailChannel) sendSMTP(addr, raw, to string) error {
	var auth smtp.Auth
	if c.user != "" && c.password != "" {
		auth = smtp.PlainAuth("", c.user, c.password, c.host)
	}

	return smtp.SendMail(addr, auth, c.from, []string{to}, []byte(raw))
}

// buildRaw constructs the RFC 2822 message.
func (c *EmailChannel) buildRaw(msg EmailMessage) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("From: %s <%s>\r\n", c.fromName, c.from))
	sb.WriteString(fmt.Sprintf("To: %s\r\n", msg.To))
	sb.WriteString(fmt.Sprintf("Subject: %s\r\n", msg.Subject))
	sb.WriteString("MIME-Version: 1.0\r\n")
	sb.WriteString("Content-Type: text/plain; charset=\"UTF-8\"\r\n")
	sb.WriteString("\r\n")
	sb.WriteString(msg.Body)
	return sb.String()
}

// validate checks required fields and address format.
func (c *EmailChannel) validate(msg EmailMessage) error {
	if strings.TrimSpace(msg.To) == "" {
		return errors.New("recipient address is required")
	}
	if !emailRegexp.MatchString(msg.To) {
		return fmt.Errorf("invalid recipient address: %s", msg.To)
	}
	if strings.TrimSpace(msg.Subject) == "" {
		return errors.New("subject is required")
	}
	if strings.TrimSpace(msg.Body) == "" {
		return errors.New("body is required")
	}
	return nil
}

func getEnvOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
