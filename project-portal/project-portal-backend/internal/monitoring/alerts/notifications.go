package alerts

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"text/template"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring"
)

// NotificationService handles alert notifications across multiple channels
type NotificationService struct {
	emailConfig   *EmailConfig
	smsConfig     *SMSConfig
	webhookConfig *WebhookConfig
	httpClient    *http.Client
}

// EmailConfig holds email notification configuration
type EmailConfig struct {
	SMTPHost     string
	SMTPPort     int
	Username     string
	Password     string
	FromAddress  string
	FromName     string
}

// SMSConfig holds SMS notification configuration
type SMSConfig struct {
	Provider  string // "twilio", "aws-sns", etc.
	AccountID string
	AuthToken string
	FromNumber string
}

// WebhookConfig holds webhook notification configuration
type WebhookConfig struct {
	URL     string
	Headers map[string]string
	Timeout time.Duration
}

// NewNotificationService creates a new notification service
func NewNotificationService(emailConfig *EmailConfig, smsConfig *SMSConfig, webhookConfig *WebhookConfig) *NotificationService {
	return &NotificationService{
		emailConfig:   emailConfig,
		smsConfig:     smsConfig,
		webhookConfig: webhookConfig,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// SendNotification sends an alert notification via configured channels
func (n *NotificationService) SendNotification(ctx context.Context, alert *monitoring.Alert, channels []string) error {
	var lastErr error
	successCount := 0

	for _, channel := range channels {
		var err error
		
		switch channel {
		case "email":
			err = n.sendEmailNotification(ctx, alert)
		case "sms":
			err = n.sendSMSNotification(ctx, alert)
		case "webhook":
			err = n.sendWebhookNotification(ctx, alert)
		case "in_app":
			// In-app notifications handled by WebSocket broadcasting
			err = nil
		default:
			err = fmt.Errorf("unknown notification channel: %s", channel)
		}

		if err != nil {
			lastErr = err
			fmt.Printf("Failed to send notification via %s: %v\n", channel, err)
		} else {
			successCount++
		}
	}

	// If at least one channel succeeded, consider it a success
	if successCount > 0 {
		return nil
	}

	return lastErr
}

// sendEmailNotification sends an email notification
func (n *NotificationService) sendEmailNotification(ctx context.Context, alert *monitoring.Alert) error {
	if n.emailConfig == nil {
		return fmt.Errorf("email configuration not set")
	}

	// Prepare email content
	subject := fmt.Sprintf("[%s] %s", alert.Severity, alert.Title)
	body, err := n.renderEmailTemplate(alert)
	if err != nil {
		return fmt.Errorf("failed to render email template: %w", err)
	}

	// In a real implementation, use a proper email library (e.g., gomail)
	// For now, this is a placeholder
	fmt.Printf("Email notification: %s\n%s\n", subject, body)
	
	return nil
}

// sendSMSNotification sends an SMS notification
func (n *NotificationService) sendSMSNotification(ctx context.Context, alert *monitoring.Alert) error {
	if n.smsConfig == nil {
		return fmt.Errorf("SMS configuration not set")
	}

	message := fmt.Sprintf("[%s] %s: %s", alert.Severity, alert.Title, alert.Message)
	
	// In a real implementation, integrate with SMS provider
	fmt.Printf("SMS notification: %s\n", message)
	
	return nil
}

// sendWebhookNotification sends a webhook notification
func (n *NotificationService) sendWebhookNotification(ctx context.Context, alert *monitoring.Alert) error {
	if n.webhookConfig == nil {
		return fmt.Errorf("webhook configuration not set")
	}

	// Prepare webhook payload
	payload := map[string]interface{}{
		"alert_id":     alert.ID,
		"project_id":   alert.ProjectID,
		"severity":     alert.Severity,
		"title":        alert.Title,
		"message":      alert.Message,
		"trigger_time": alert.TriggerTime.Format(time.RFC3339),
		"status":       alert.Status,
		"details":      alert.Details,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook payload: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", n.webhookConfig.URL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create webhook request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	for key, value := range n.webhookConfig.Headers {
		req.Header.Set(key, value)
	}

	// Send request
	resp, err := n.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send webhook: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("webhook returned status code: %d", resp.StatusCode)
	}

	return nil
}

// renderEmailTemplate renders the email body from a template
func (n *NotificationService) renderEmailTemplate(alert *monitoring.Alert) (string, error) {
	tmpl := `
Alert Notification
==================

Project: {{.ProjectID}}
Severity: {{.Severity}}
Title: {{.Title}}

Message:
{{.Message}}

Triggered At: {{.TriggerTime}}
Status: {{.Status}}

Details:
{{range $key, $value := .Details}}
  {{$key}}: {{$value}}
{{end}}

---
This is an automated alert from CarbonScribe Monitoring System
`

	t, err := template.New("alert").Parse(tmpl)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	if err := t.Execute(&buf, alert); err != nil {
		return "", err
	}

	return buf.String(), nil
}

// NotificationWorker processes alerts from the notification queue
type NotificationWorker struct {
	repo    monitoring.Repository
	service *NotificationService
	queue   <-chan *monitoring.Alert
}

// NewNotificationWorker creates a new notification worker
func NewNotificationWorker(repo monitoring.Repository, service *NotificationService, queue <-chan *monitoring.Alert) *NotificationWorker {
	return &NotificationWorker{
		repo:    repo,
		service: service,
		queue:   queue,
	}
}

// Start begins processing notifications from the queue
func (w *NotificationWorker) Start(ctx context.Context) {
	fmt.Println("Notification worker started")
	
	for {
		select {
		case <-ctx.Done():
			fmt.Println("Notification worker stopped")
			return
			
		case alert := <-w.queue:
			if err := w.processAlert(ctx, alert); err != nil {
				fmt.Printf("Error processing alert notification %s: %v\n", alert.ID, err)
			}
		}
	}
}

// processAlert processes a single alert notification
func (w *NotificationWorker) processAlert(ctx context.Context, alert *monitoring.Alert) error {
	// Get the alert rule to determine notification channels
	if alert.RuleID == nil {
		return fmt.Errorf("alert has no associated rule")
	}

	rule, err := w.repo.GetAlertRuleByID(ctx, *alert.RuleID)
	if err != nil {
		return fmt.Errorf("failed to get alert rule: %w", err)
	}

	// Extract notification channels
	channels := []string{}
	if rule.NotificationChannels != nil {
		for _, ch := range rule.NotificationChannels {
			if chStr, ok := ch.(string); ok {
				channels = append(channels, chStr)
			}
		}
	}

	if len(channels) == 0 {
		channels = []string{"in_app"} // Default to in-app notifications
	}

	// Send notification
	err = w.service.SendNotification(ctx, alert, channels)
	
	// Update alert notification status
	alert.NotificationAttempts++
	if err == nil {
		alert.NotificationSent = true
	}
	
	if updateErr := w.repo.UpdateAlert(ctx, alert); updateErr != nil {
		fmt.Printf("Failed to update alert notification status: %v\n", updateErr)
	}

	return err
}
