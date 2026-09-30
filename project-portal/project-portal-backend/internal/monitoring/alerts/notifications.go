package alerts

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/monitoring"
	"carbon-scribe/project-portal/project-portal-backend/pkg/aws"
)

// NotificationService handles alert notifications.
type NotificationService struct {
	httpClient *http.Client
	// emailer is optional: when nil, sendEmail/sendResolutionEmail fall
	// back to logging instead of failing.
	emailer aws.EmailClient
}

// NotificationServiceOption configures optional NotificationService
// dependencies.
type NotificationServiceOption func(*NotificationService)

// WithEmailClient wires a transactional email client into the service so
// alert/resolution notifications are actually emailed to
// EmailConfig.To recipients instead of only being logged.
func WithEmailClient(emailer aws.EmailClient) NotificationServiceOption {
	return func(n *NotificationService) {
		n.emailer = emailer
	}
}

// NewNotificationService creates a new NotificationService.
func NewNotificationService(opts ...NotificationServiceOption) *NotificationService {
	n := &NotificationService{
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
	for _, opt := range opts {
		opt(n)
	}
	return n
}

// SendAlert sends a notification for a triggered alert.
func (n *NotificationService) SendAlert(ctx context.Context, alert *monitoring.SystemAlert, rule *AlertRule) {
	if rule.Notification == nil {
		return
	}

	for _, channel := range rule.Notification.Channels {
		switch channel {
		case "email":
			n.sendEmail(ctx, alert, rule)
		case "webhook":
			n.sendWebhook(ctx, alert, rule)
		case "websocket":
			n.sendWebsocket(ctx, alert, rule)
		case "sms":
			n.sendSMS(ctx, alert, rule)
		}
	}
}

// SendAlertResolution sends a notification for a resolved alert.
func (n *NotificationService) SendAlertResolution(ctx context.Context, alert *monitoring.SystemAlert, rule *AlertRule) {
	if rule.Notification == nil {
		return
	}

	for _, channel := range rule.Notification.Channels {
		switch channel {
		case "email":
			n.sendResolutionEmail(ctx, alert, rule)
		case "webhook":
			n.sendResolutionWebhook(ctx, alert, rule)
		case "websocket":
			n.sendResolutionWebsocket(ctx, alert, rule)
		}
	}
}

// sendEmail sends an email notification for a triggered alert.
func (n *NotificationService) sendEmail(ctx context.Context, alert *monitoring.SystemAlert, rule *AlertRule) {
	n.sendAlertEmail(ctx, alert, rule, "triggered")
}

// sendResolutionEmail sends an email notification for a resolved alert.
func (n *NotificationService) sendResolutionEmail(ctx context.Context, alert *monitoring.SystemAlert, rule *AlertRule) {
	n.sendAlertEmail(ctx, alert, rule, "resolved")
}

// sendAlertEmail renders and sends (or, with no email client configured,
// logs) an alert notification email to every recipient configured on the
// rule's EmailConfig.
func (n *NotificationService) sendAlertEmail(ctx context.Context, alert *monitoring.SystemAlert, rule *AlertRule, status string) {
	if rule.Notification == nil || rule.Notification.Email == nil || len(rule.Notification.Email.To) == 0 {
		log.Printf("[EMAIL] %s: %s - %s (no recipients configured)", strings.ToUpper(status), alert.Title, alert.Message)
		return
	}

	timestamp := alert.CreatedAt
	if status == "resolved" && alert.ResolvedAt != nil {
		timestamp = *alert.ResolvedAt
	}

	subject, htmlBody, textBody := aws.RenderAlertEmail(aws.AlertEmailData{
		Title:       alert.Title,
		Message:     alert.Message,
		Severity:    string(alert.Severity),
		ServiceName: alert.ServiceName,
		Status:      status,
		Timestamp:   timestamp,
	})
	if rule.Notification.Email.Subject != "" {
		subject = rule.Notification.Email.Subject
	}

	if n.emailer == nil {
		log.Printf("[EMAIL] %s: %s - %s (no email client configured; would send to %v)",
			strings.ToUpper(status), alert.Title, alert.Message, rule.Notification.Email.To)
		return
	}

	for _, to := range rule.Notification.Email.To {
		if err := n.emailer.SendEmail(ctx, to, subject, htmlBody, textBody); err != nil {
			log.Printf("alerts: failed to send %s email to %s for alert %s: %v", status, to, alert.ID, err)
		}
	}
}

// sendWebhook sends a webhook notification.
func (n *NotificationService) sendWebhook(ctx context.Context, alert *monitoring.SystemAlert, rule *AlertRule) {
	if rule.Notification.Webhook == nil {
		return
	}

	payload := map[string]interface{}{
		"id":         alert.ID,
		"title":      alert.Title,
		"message":    alert.Message,
		"severity":   alert.Severity,
		"service":    alert.ServiceName,
		"status":     alert.Status,
		"timestamp":  alert.CreatedAt.Format(time.RFC3339),
		"details":    alert.Details,
		"event_type": "alert_triggered",
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return
	}

	req, err := http.NewRequestWithContext(ctx, "POST", rule.Notification.Webhook.URL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return
	}

	req.Header.Set("Content-Type", "application/json")
	for key, value := range rule.Notification.Webhook.Headers {
		req.Header.Set(key, value)
	}

	resp, err := n.httpClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
}

// sendResolutionWebhook sends a resolution webhook notification.
func (n *NotificationService) sendResolutionWebhook(ctx context.Context, alert *monitoring.SystemAlert, rule *AlertRule) {
	if rule.Notification.Webhook == nil {
		return
	}

	payload := map[string]interface{}{
		"id":         alert.ID,
		"title":      alert.Title,
		"message":    alert.Message,
		"severity":   alert.Severity,
		"service":    alert.ServiceName,
		"status":     "resolved",
		"timestamp":  alert.ResolvedAt.Format(time.RFC3339),
		"details":    alert.Details,
		"event_type": "alert_resolved",
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return
	}

	req, err := http.NewRequestWithContext(ctx, "POST", rule.Notification.Webhook.URL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return
	}

	req.Header.Set("Content-Type", "application/json")
	for key, value := range rule.Notification.Webhook.Headers {
		req.Header.Set(key, value)
	}

	resp, err := n.httpClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
}

// sendWebsocket sends a websocket notification.
func (n *NotificationService) sendWebsocket(ctx context.Context, alert *monitoring.SystemAlert, rule *AlertRule) {
	// Placeholder for websocket integration
	fmt.Printf("[WEBSOCKET] Alert: %s - %s\n", alert.Title, alert.Message)
}

// sendResolutionWebsocket sends a resolution websocket notification.
func (n *NotificationService) sendResolutionWebsocket(ctx context.Context, alert *monitoring.SystemAlert, rule *AlertRule) {
	fmt.Printf("[WEBSOCKET] Resolved: %s - %s\n", alert.Title, alert.Message)
}

// sendSMS sends an SMS notification.
func (n *NotificationService) sendSMS(ctx context.Context, alert *monitoring.SystemAlert, rule *AlertRule) {
	// Placeholder for SMS integration
	fmt.Printf("[SMS] Alert: %s - %s\n", alert.Title, alert.Message)
}
