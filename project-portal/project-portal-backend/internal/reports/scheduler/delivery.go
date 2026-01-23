package scheduler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/smtp"
	"time"

	"go.uber.org/zap"
)

// DeliveryManager handles report delivery
type DeliveryManager struct {
	emailConfig   EmailConfig
	httpClient    *http.Client
	logger        *zap.Logger
}

// EmailConfig configuration for email delivery
type EmailConfig struct {
	SMTPHost     string `json:"smtp_host"`
	SMTPPort     int    `json:"smtp_port"`
	Username     string `json:"username"`
	Password     string `json:"password"`
	FromAddress  string `json:"from_address"`
	FromName     string `json:"from_name"`
	EnableTLS    bool   `json:"enable_tls"`
}

// EmailDelivery represents an email delivery request
type EmailDelivery struct {
	To          []string     `json:"to"`
	CC          []string     `json:"cc,omitempty"`
	BCC         []string     `json:"bcc,omitempty"`
	Subject     string       `json:"subject"`
	Body        string       `json:"body"`
	HTMLBody    string       `json:"html_body,omitempty"`
	Attachments []Attachment `json:"attachments,omitempty"`
}

// Attachment represents an email attachment
type Attachment struct {
	Name        string `json:"name"`
	Data        []byte `json:"data"`
	ContentType string `json:"content_type"`
}

// WebhookDelivery represents a webhook delivery request
type WebhookDelivery struct {
	URL         string          `json:"url"`
	Method      string          `json:"method,omitempty"` // Default: POST
	Headers     map[string]string `json:"headers,omitempty"`
	Payload     map[string]any  `json:"payload"`
	Timeout     time.Duration   `json:"timeout,omitempty"`
	RetryCount  int             `json:"retry_count,omitempty"`
}

// S3Delivery represents an S3 delivery request
type S3Delivery struct {
	Bucket      string            `json:"bucket"`
	Key         string            `json:"key"`
	Data        []byte            `json:"data"`
	ContentType string            `json:"content_type"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

// NotificationDelivery represents an internal notification
type NotificationDelivery struct {
	UserIDs    []string          `json:"user_ids"`
	Title      string            `json:"title"`
	Message    string            `json:"message"`
	Type       string            `json:"type"` // info, success, warning, error
	ActionURL  string            `json:"action_url,omitempty"`
	Data       map[string]any    `json:"data,omitempty"`
}

// DeliveryResult represents the result of a delivery attempt
type DeliveryResult struct {
	Method      string    `json:"method"`
	Success     bool      `json:"success"`
	Recipient   string    `json:"recipient,omitempty"`
	Error       string    `json:"error,omitempty"`
	DeliveredAt time.Time `json:"delivered_at"`
	RetryCount  int       `json:"retry_count"`
}

// NewDeliveryManager creates a new delivery manager
func NewDeliveryManager(emailConfig EmailConfig, logger *zap.Logger) *DeliveryManager {
	return &DeliveryManager{
		emailConfig: emailConfig,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		logger: logger,
	}
}

// DeliverByEmail sends a report via email
func (d *DeliveryManager) DeliverByEmail(ctx context.Context, delivery *EmailDelivery) error {
	if len(delivery.To) == 0 {
		return fmt.Errorf("no recipients specified")
	}

	d.logger.Info("Sending email",
		zap.Strings("to", delivery.To),
		zap.String("subject", delivery.Subject))

	// Build email message
	msg := d.buildEmailMessage(delivery)

	// SMTP authentication
	auth := smtp.PlainAuth("", d.emailConfig.Username, d.emailConfig.Password, d.emailConfig.SMTPHost)

	// Send email
	addr := fmt.Sprintf("%s:%d", d.emailConfig.SMTPHost, d.emailConfig.SMTPPort)
	err := smtp.SendMail(addr, auth, d.emailConfig.FromAddress, delivery.To, msg)
	if err != nil {
		d.logger.Error("Failed to send email",
			zap.Error(err),
			zap.Strings("to", delivery.To))
		return fmt.Errorf("failed to send email: %w", err)
	}

	d.logger.Info("Email sent successfully",
		zap.Strings("to", delivery.To))

	return nil
}

// buildEmailMessage builds an email message with attachments
func (d *DeliveryManager) buildEmailMessage(delivery *EmailDelivery) []byte {
	var buf bytes.Buffer
	boundary := "----=_Part_0_1234567890"

	// Headers
	buf.WriteString(fmt.Sprintf("From: %s <%s>\r\n", d.emailConfig.FromName, d.emailConfig.FromAddress))
	buf.WriteString(fmt.Sprintf("To: %s\r\n", delivery.To[0]))
	buf.WriteString(fmt.Sprintf("Subject: %s\r\n", delivery.Subject))
	buf.WriteString("MIME-Version: 1.0\r\n")

	if len(delivery.Attachments) > 0 {
		buf.WriteString(fmt.Sprintf("Content-Type: multipart/mixed; boundary=\"%s\"\r\n", boundary))
		buf.WriteString("\r\n")

		// Body part
		buf.WriteString(fmt.Sprintf("--%s\r\n", boundary))
		buf.WriteString("Content-Type: text/plain; charset=utf-8\r\n")
		buf.WriteString("\r\n")
		buf.WriteString(delivery.Body)
		buf.WriteString("\r\n")

		// Attachments
		for _, attachment := range delivery.Attachments {
			buf.WriteString(fmt.Sprintf("--%s\r\n", boundary))
			buf.WriteString(fmt.Sprintf("Content-Type: %s; name=\"%s\"\r\n", attachment.ContentType, attachment.Name))
			buf.WriteString("Content-Transfer-Encoding: base64\r\n")
			buf.WriteString(fmt.Sprintf("Content-Disposition: attachment; filename=\"%s\"\r\n", attachment.Name))
			buf.WriteString("\r\n")

			// Base64 encode attachment
			encoded := base64Encode(attachment.Data)
			buf.WriteString(encoded)
			buf.WriteString("\r\n")
		}

		buf.WriteString(fmt.Sprintf("--%s--\r\n", boundary))
	} else {
		buf.WriteString("Content-Type: text/plain; charset=utf-8\r\n")
		buf.WriteString("\r\n")
		buf.WriteString(delivery.Body)
	}

	return buf.Bytes()
}

// DeliverByWebhook sends a report notification via webhook
func (d *DeliveryManager) DeliverByWebhook(ctx context.Context, delivery *WebhookDelivery) error {
	if delivery.URL == "" {
		return fmt.Errorf("webhook URL is required")
	}

	method := delivery.Method
	if method == "" {
		method = "POST"
	}

	timeout := delivery.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	d.logger.Info("Sending webhook",
		zap.String("url", delivery.URL),
		zap.String("method", method))

	// Marshal payload
	payloadBytes, err := json.Marshal(delivery.Payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	// Create request
	req, err := http.NewRequestWithContext(ctx, method, delivery.URL, bytes.NewReader(payloadBytes))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	for key, value := range delivery.Headers {
		req.Header.Set(key, value)
	}

	// Send request with retries
	var lastErr error
	retries := delivery.RetryCount
	if retries == 0 {
		retries = 1
	}

	for attempt := 0; attempt < retries; attempt++ {
		resp, err := d.httpClient.Do(req)
		if err != nil {
			lastErr = err
			d.logger.Warn("Webhook request failed, retrying",
				zap.Int("attempt", attempt+1),
				zap.Error(err))
			time.Sleep(time.Second * time.Duration(attempt+1))
			continue
		}
		resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			d.logger.Info("Webhook delivered successfully",
				zap.String("url", delivery.URL),
				zap.Int("status_code", resp.StatusCode))
			return nil
		}

		lastErr = fmt.Errorf("webhook returned status %d", resp.StatusCode)
		d.logger.Warn("Webhook returned non-success status",
			zap.Int("attempt", attempt+1),
			zap.Int("status_code", resp.StatusCode))
	}

	return fmt.Errorf("webhook delivery failed after %d attempts: %w", retries, lastErr)
}

// DeliverNotification sends an internal notification
func (d *DeliveryManager) DeliverNotification(ctx context.Context, delivery *NotificationDelivery) error {
	d.logger.Info("Sending notification",
		zap.Strings("user_ids", delivery.UserIDs),
		zap.String("title", delivery.Title))

	// In production, this would integrate with a notification service
	// For now, just log the notification
	d.logger.Info("Notification sent",
		zap.Strings("user_ids", delivery.UserIDs),
		zap.String("title", delivery.Title),
		zap.String("message", delivery.Message))

	return nil
}

// base64Encode encodes data to base64 with line breaks
func base64Encode(data []byte) string {
	const lineLen = 76
	encoded := make([]byte, ((len(data)+2)/3)*4)

	// Simple base64 encoding
	const encodeStd = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

	n := len(data)
	dst := encoded
	for i := 0; i < n/3; i++ {
		val := uint(data[i*3])<<16 | uint(data[i*3+1])<<8 | uint(data[i*3+2])
		dst[i*4] = encodeStd[val>>18&0x3F]
		dst[i*4+1] = encodeStd[val>>12&0x3F]
		dst[i*4+2] = encodeStd[val>>6&0x3F]
		dst[i*4+3] = encodeStd[val&0x3F]
	}

	// Handle remainder
	remainder := n % 3
	if remainder > 0 {
		i := n / 3
		val := uint(data[i*3]) << 16
		if remainder == 2 {
			val |= uint(data[i*3+1]) << 8
		}
		dst[i*4] = encodeStd[val>>18&0x3F]
		dst[i*4+1] = encodeStd[val>>12&0x3F]
		if remainder == 2 {
			dst[i*4+2] = encodeStd[val>>6&0x3F]
			dst[i*4+3] = '='
		} else {
			dst[i*4+2] = '='
			dst[i*4+3] = '='
		}
	}

	// Add line breaks
	var result bytes.Buffer
	for i := 0; i < len(encoded); i += lineLen {
		end := i + lineLen
		if end > len(encoded) {
			end = len(encoded)
		}
		result.Write(encoded[i:end])
		result.WriteString("\r\n")
	}

	return result.String()
}
