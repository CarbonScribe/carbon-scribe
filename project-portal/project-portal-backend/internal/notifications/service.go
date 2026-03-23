package notifications

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/notifications/templates"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Service interface {
	SendNotification(ctx context.Context, req NotificationRequest) error
	BroadcastAdminMessage(ctx context.Context, message string) error
	
	// Template Management
	CreateTemplate(ctx context.Context, t *NotificationTemplate) error
	PreviewTemplate(ctx context.Context, id string, data map[string]interface{}) (string, error)
	
	// Preferences
	GetUserPreferences(ctx context.Context, userID string) ([]UserPreference, error)
	UpdateUserPreference(ctx context.Context, pref UserPreference) error

	// Rules
	CreateRule(ctx context.Context, rule NotificationRule) error
	EvaluateRules(ctx context.Context, projectID string, data map[string]interface{}) error
}

type notificationService struct {
	repo     Repository
	emailSvc Channel // Mock SES
	smsSvc   Channel // Mock SNS
	wsSvc    Channel // Mock WebSocket
}

type Channel interface {
	Send(ctx context.Context, recipient string, subject string, body string) (string, error)
}

func NewService(repo Repository, email, sms, ws Channel) Service {
	return &notificationService{
		repo:     repo,
		emailSvc: email,
		smsSvc:   sms,
		wsSvc:    ws,
	}
}

func (s *notificationService) SendNotification(ctx context.Context, req NotificationRequest) error {
	// 1. Check user preferences
	prefs, _ := s.repo.GetPreferences(ctx, req.UserID)
	enabled := false
	for _, p := range prefs {
		if strings.ToUpper(p.Channel) == strings.ToUpper(req.Channel) && p.Enabled {
			enabled = true
			break
		}
	}
	// If no specific preference found, we might have default behavior. 
	// For this mock, if preferences exist but this channel isn't enabled, we skip.
	// If no preferences exist, we allow it (simplified logic).
	if len(prefs) > 0 && !enabled {
		log.Printf("Notification suppressed for user %s on channel %s due to preferences", req.UserID, req.Channel)
		return nil
	}

	// 2. Get template
	templateID, err := primitive.ObjectIDFromHex(req.TemplateID)
	if err != nil {
		return fmt.Errorf("invalid template ID: %w", err)
	}
	tmpl, err := s.repo.GetTemplate(ctx, templateID)
	if err != nil {
		return fmt.Errorf("template not found: %w", err)
	}

	// 3. Render template
	subject := renderString(tmpl.Subject, req.Data)
	body := renderString(tmpl.Body, req.Data)

	// 4. Send via channel
	var providerID string
	var sendErr error

	switch strings.ToUpper(req.Channel) {
	case "EMAIL":
		providerID, sendErr = s.emailSvc.Send(ctx, req.UserID, subject, body) // recipient ID used as placeholder
	case "SMS":
		providerID, sendErr = s.smsSvc.Send(ctx, req.UserID, "", body)
	case "WEBSOCKET", "WS":
		providerID, sendErr = s.wsSvc.Send(ctx, req.UserID, subject, body)
	default:
		return fmt.Errorf("unsupported channel: %s", req.Channel)
	}

	// 5. Log delivery
	status := "SENT"
	if sendErr != nil {
		status = "FAILED"
	}
	logEntry := &DeliveryLog{
		NotificationID:    primitive.NewObjectID().Hex(),
		UserID:            req.UserID,
		Channel:           req.Channel,
		TemplateID:        req.TemplateID,
		Status:            status,
		ProviderMessageID: providerID,
		Timestamp:         time.Now(),
	}
	if sendErr != nil {
		logEntry.ProviderResponse = map[string]interface{}{"error": sendErr.Error()}
	}

	_ = s.repo.CreateDeliveryLog(ctx, logEntry)

	return sendErr
}

func (s *notificationService) BroadcastAdminMessage(ctx context.Context, message string) error {
	conns, err := s.repo.GetAllConnections(ctx)
	if err != nil {
		return err
	}
	for _, conn := range conns {
		_, _ = s.wsSvc.Send(ctx, conn.UserID, "Broadcast", message)
	}
	return nil
}

func (s *notificationService) CreateTemplate(ctx context.Context, t *NotificationTemplate) error {
	return s.repo.CreateTemplate(ctx, t)
}

func (s *notificationService) PreviewTemplate(ctx context.Context, id string, data map[string]interface{}) (string, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return "", err
	}
	tmpl, err := s.repo.GetTemplate(ctx, objID)
	if err != nil {
		return "", err
	}
	return renderString(tmpl.Body, data), nil
}

func (s *notificationService) GetUserPreferences(ctx context.Context, userID string) ([]UserPreference, error) {
	return s.repo.GetPreferences(ctx, userID)
}

func (s *notificationService) UpdateUserPreference(ctx context.Context, pref UserPreference) error {
	return s.repo.UpdatePreference(ctx, &pref)
}

func (s *notificationService) CreateRule(ctx context.Context, rule NotificationRule) error {
	return s.repo.CreateRule(ctx, &rule)
}

func (s *notificationService) EvaluateRules(ctx context.Context, projectID string, data map[string]interface{}) error {
	rules, err := s.repo.GetRulesByProject(ctx, projectID)
	if err != nil {
		return err
	}

	for _, rule := range rules {
		if !rule.IsActive {
			continue
		}
		// Simplified rule evaluation: if any condition matches (mock)
		// Real engine would parse conditions
		matched := true // Mocking match for now
		if matched {
			for _, action := range rule.Actions {
				channel, _ := action["channel"].(string)
				templateID, _ := action["templateId"].(string)
				_ = s.SendNotification(ctx, NotificationRequest{
					UserID:     data["userId"].(string), // target user from event
					Channel:    channel,
					TemplateID: templateID,
					Data:       data,
				})
			}
			rule.LastTriggered = primitive.NewObjectID().Timestamp()
			rule.TriggerCount++
			_ = s.repo.UpdateRule(ctx, &rule)
		}
	}
	return nil
}

// Helper for template rendering
func renderString(tmpl string, data map[string]interface{}) string {
	return templates.Render(tmpl, data)
}
