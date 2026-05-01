package notifications

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	repo          Repository
	retryLimit    int
	defaultLocale string
}

func NewService(repo Repository) *Service {
	return &Service{
		repo:          repo,
		retryLimit:    3,
		defaultLocale: "en",
	}
}

func (s *Service) ListUserNotifications(ctx context.Context, userID string, limit int64) ([]Notification, error) {
	return s.repo.ListNotificationsByUser(ctx, userID, limit)
}

func (s *Service) SendNotification(ctx context.Context, req SendNotificationRequest) (*Notification, error) {
	if req.UserID == "" {
		return nil, errors.New("user_id is required")
	}
	if len(req.Channels) == 0 {
		return nil, errors.New("at least one channel is required")
	}

	content := req.Content
	subject := req.Subject
	if req.TemplateID != "" {
		tpl, err := s.repo.GetTemplateByID(ctx, req.TemplateID)
		if err != nil {
			return nil, err
		}
		if tpl == nil {
			return nil, errors.New("template not found")
		}
		subject = s.renderTemplate(tpl.Subject, req.Variables)
		content = s.renderTemplate(tpl.Body, req.Variables)
	}

	now := time.Now().UTC()
	n := &Notification{
		ID:         uuid.NewString(),
		UserID:     req.UserID,
		ProjectID:  req.ProjectID,
		Category:   req.Category,
		Subject:    subject,
		Content:    content,
		Channels:   req.Channels,
		Status:     StatusPending,
		TemplateID: req.TemplateID,
		Metadata:   req.Metadata,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if err := s.repo.CreateNotification(ctx, n); err != nil {
		return nil, err
	}

	finalStatus := StatusSent
	for _, channel := range req.Channels {
		attemptStatus, providerResponse := s.mockDeliver(channel, req.Destinations, subject, content)
		attempt := &DeliveryAttempt{
			AttemptID:        uuid.NewString(),
			NotificationID:   n.ID,
			UserID:           req.UserID,
			Channel:          strings.ToUpper(channel),
			Status:           attemptStatus,
			ProviderResponse: providerResponse,
			RetryCount:       0,
			CreatedAt:        time.Now().UTC(),
		}

		if attemptStatus == StatusSent || attemptStatus == StatusDelivered {
			attempt.ProviderMessageID = uuid.NewString()
			attempt.FinalStatus = StatusDelivered
		} else {
			attempt.FinalStatus = StatusFailed
			finalStatus = StatusFailed
		}

		if err := s.repo.CreateDeliveryAttempt(ctx, attempt); err != nil {
			return nil, err
		}
	}

	var deliveredAt *time.Time
	if finalStatus != StatusFailed {
		ts := time.Now().UTC()
		deliveredAt = &ts
		finalStatus = StatusDelivered
	}

	if err := s.repo.UpdateNotificationStatus(ctx, n.ID, finalStatus, deliveredAt); err != nil {
		return nil, err
	}
	n.Status = finalStatus
	n.DeliveredAt = deliveredAt
	n.UpdatedAt = time.Now().UTC()

	return n, nil
}

func (s *Service) GetNotificationStatus(ctx context.Context, notificationID string) (map[string]interface{}, error) {
	n, err := s.repo.GetNotificationByID(ctx, notificationID)
	if err != nil {
		return nil, err
	}
	if n == nil {
		return nil, errors.New("notification not found")
	}

	attempts, err := s.repo.ListDeliveryAttempts(ctx, notificationID)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"notification": n,
		"attempts":     attempts,
	}, nil
}

func (s *Service) GetPreferences(ctx context.Context, userID string) ([]UserPreference, error) {
	return s.repo.ListPreferencesByUser(ctx, userID)
}

func (s *Service) UpdatePreferences(ctx context.Context, userID string, req UpdatePreferencesRequest) ([]UserPreference, error) {
	now := time.Now().UTC()
	for _, channel := range req.EnabledChannels {
		pref := &UserPreference{
			ID:              fmt.Sprintf("%s:%s:%s", userID, strings.ToUpper(channel), req.Category),
			UserID:          userID,
			Channel:         strings.ToUpper(channel),
			Category:        req.Category,
			Enabled:         true,
			QuietHoursStart: req.QuietHoursStart,
			QuietHoursEnd:   req.QuietHoursEnd,
			UpdatedAt:       now,
		}
		if err := s.repo.PutPreference(ctx, pref); err != nil {
			return nil, err
		}
	}

	for _, channel := range req.DisabledChannels {
		pref := &UserPreference{
			ID:              fmt.Sprintf("%s:%s:%s", userID, strings.ToUpper(channel), req.Category),
			UserID:          userID,
			Channel:         strings.ToUpper(channel),
			Category:        req.Category,
			Enabled:         false,
			QuietHoursStart: req.QuietHoursStart,
			QuietHoursEnd:   req.QuietHoursEnd,
			UpdatedAt:       now,
		}
		if err := s.repo.PutPreference(ctx, pref); err != nil {
			return nil, err
		}
	}

	return s.repo.ListPreferencesByUser(ctx, userID)
}

func (s *Service) ListTemplates(ctx context.Context) ([]NotificationTemplate, error) {
	return s.repo.ListTemplates(ctx)
}

func (s *Service) CreateTemplate(ctx context.Context, tpl NotificationTemplate) (*NotificationTemplate, error) {
	if tpl.Type == "" || tpl.Body == "" {
		return nil, errors.New("type and body are required")
	}
	now := time.Now().UTC()
	tpl.ID = uuid.NewString()
	tpl.Language = strings.TrimSpace(tpl.Language)
	if tpl.Language == "" {
		tpl.Language = s.defaultLocale
	}
	if tpl.Version <= 0 {
		tpl.Version = 1
	}
	tpl.CreatedAt = now
	tpl.UpdatedAt = now

	if err := s.repo.CreateTemplate(ctx, &tpl); err != nil {
		return nil, err
	}
	return &tpl, nil
}

func (s *Service) PreviewTemplate(ctx context.Context, templateID string, vars map[string]interface{}) (map[string]string, error) {
	tpl, err := s.repo.GetTemplateByID(ctx, templateID)
	if err != nil {
		return nil, err
	}
	if tpl == nil {
		return nil, errors.New("template not found")
	}

	return map[string]string{
		"subject": s.renderTemplate(tpl.Subject, vars),
		"body":    s.renderTemplate(tpl.Body, vars),
	}, nil
}

func (s *Service) CreateRule(ctx context.Context, rule NotificationRule) (*NotificationRule, error) {
	if rule.ProjectID == "" || rule.Name == "" {
		return nil, errors.New("project_id and name are required")
	}
	if len(rule.Actions) == 0 {
		return nil, errors.New("at least one action is required")
	}
	now := time.Now().UTC()
	rule.ID = uuid.NewString()
	rule.IsActive = true
	rule.CreatedAt = now
	rule.UpdatedAt = now

	if err := s.repo.CreateRule(ctx, &rule); err != nil {
		return nil, err
	}
	return &rule, nil
}

func (s *Service) UpdateRule(ctx context.Context, id string, updated NotificationRule) (*NotificationRule, error) {
	existing, err := s.repo.GetRuleByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, errors.New("rule not found")
	}

	if updated.Name != "" {
		existing.Name = updated.Name
	}
	if updated.Description != "" {
		existing.Description = updated.Description
	}
	if len(updated.Conditions) > 0 {
		existing.Conditions = updated.Conditions
	}
	if len(updated.Actions) > 0 {
		existing.Actions = updated.Actions
	}
	existing.IsActive = updated.IsActive
	if updated.Schedule != "" {
		existing.Schedule = updated.Schedule
	}
	existing.UpdatedAt = time.Now().UTC()

	if err := s.repo.UpdateRule(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *Service) ListRules(ctx context.Context, projectID string) ([]NotificationRule, error) {
	return s.repo.ListRules(ctx, projectID)
}

func (s *Service) TestRule(ctx context.Context, id string, sampleData map[string]interface{}) (map[string]interface{}, error) {
	rule, err := s.repo.GetRuleByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if rule == nil {
		return nil, errors.New("rule not found")
	}

	matched := true
	details := make([]map[string]interface{}, 0, len(rule.Conditions))
	for _, condition := range rule.Conditions {
		result := evaluateCondition(condition, sampleData)
		details = append(details, map[string]interface{}{
			"field":    condition.Field,
			"operator": condition.Operator,
			"expected": condition.Value,
			"actual":   sampleData[condition.Field],
			"matched":  result,
		})
		matched = matched && result
	}

	return map[string]interface{}{
		"rule_id":    id,
		"matched":    matched,
		"conditions": details,
		"actions":    rule.Actions,
	}, nil
}

func (s *Service) Broadcast(ctx context.Context, req BroadcastRequest) (map[string]interface{}, error) {
	conns, err := s.repo.ListConnections(ctx, req.ProjectID, req.UserID)
	if err != nil {
		return nil, err
	}

	connectionIDs := make([]string, 0, len(conns))
	for _, conn := range conns {
		connectionIDs = append(connectionIDs, conn.ConnectionID)
	}

	return map[string]interface{}{
		"sent_to_connections": len(connectionIDs),
		"connection_ids":      connectionIDs,
		"message":             req.Message,
	}, nil
}

func (s *Service) RegisterConnection(ctx context.Context, conn WebSocketConnection) error {
	if conn.ConnectionID == "" {
		return errors.New("connection_id is required")
	}
	if conn.UserID == "" {
		return errors.New("user_id is required")
	}
	now := time.Now().UTC()
	if conn.ConnectedAt.IsZero() {
		conn.ConnectedAt = now
	}
	conn.LastActivity = now
	return s.repo.UpsertConnection(ctx, &conn)
}

func (s *Service) Disconnect(ctx context.Context, connectionID string) error {
	return s.repo.DeleteConnection(ctx, connectionID)
}

func (s *Service) Metrics(ctx context.Context) (*DeliveryMetrics, error) {
	return s.repo.Metrics(ctx)
}

func (s *Service) ProcessWebhook(ctx context.Context, provider string, payload map[string]interface{}) error {
	notificationID, _ := payload["notification_id"].(string)
	if notificationID == "" {
		return errors.New("notification_id is required")
	}
	status := strings.ToUpper(fmt.Sprintf("%v", payload["status"]))
	if status == "" {
		status = StatusDelivered
	}
	providerMessageID, _ := payload["provider_message_id"].(string)

	attempt := &DeliveryAttempt{
		AttemptID:         uuid.NewString(),
		NotificationID:    notificationID,
		Channel:           strings.ToUpper(provider),
		Status:            status,
		ProviderMessageID: providerMessageID,
		ProviderResponse:  payload,
		RetryCount:        0,
		FinalStatus:       status,
		CreatedAt:         time.Now().UTC(),
	}
	if err := s.repo.CreateDeliveryAttempt(ctx, attempt); err != nil {
		return err
	}

	var deliveredAt *time.Time
	if status == StatusDelivered || status == StatusSent {
		now := time.Now().UTC()
		deliveredAt = &now
	}
	return s.repo.UpdateNotificationStatus(ctx, notificationID, status, deliveredAt)
}

func (s *Service) renderTemplate(template string, vars map[string]interface{}) string {
	if template == "" || len(vars) == 0 {
		return template
	}
	re := regexp.MustCompile(`\{\{\s*([a-zA-Z0-9_]+)\s*\}\}`)
	return re.ReplaceAllStringFunc(template, func(match string) string {
		parts := re.FindStringSubmatch(match)
		if len(parts) != 2 {
			return match
		}
		if v, ok := vars[parts[1]]; ok {
			return fmt.Sprintf("%v", v)
		}
		return match
	})
}

func evaluateCondition(condition RuleCondition, sampleData map[string]interface{}) bool {
	actual, exists := sampleData[condition.Field]
	if !exists {
		return false
	}

	switch strings.ToLower(condition.Operator) {
	case "eq", "==":
		return fmt.Sprintf("%v", actual) == fmt.Sprintf("%v", condition.Value)
	case "neq", "!=":
		return fmt.Sprintf("%v", actual) != fmt.Sprintf("%v", condition.Value)
	case "gt":
		return toFloat(actual) > toFloat(condition.Value)
	case "gte":
		return toFloat(actual) >= toFloat(condition.Value)
	case "lt":
		return toFloat(actual) < toFloat(condition.Value)
	case "lte":
		return toFloat(actual) <= toFloat(condition.Value)
	case "contains":
		return strings.Contains(strings.ToLower(fmt.Sprintf("%v", actual)), strings.ToLower(fmt.Sprintf("%v", condition.Value)))
	default:
		return false
	}
}

func toFloat(v interface{}) float64 {
	switch t := v.(type) {
	case float64:
		return t
	case float32:
		return float64(t)
	case int:
		return float64(t)
	case int32:
		return float64(t)
	case int64:
		return float64(t)
	default:
		return 0
	}
}

func (s *Service) mockDeliver(channel string, destinations map[string]string, subject, content string) (string, map[string]interface{}) {
	ch := strings.ToUpper(channel)
	target := ""
	if destinations != nil {
		target = destinations[ch]
	}
	if target == "" && ch != ChannelInApp && ch != ChannelWebSocket {
		return StatusFailed, map[string]interface{}{"error": "missing destination", "channel": ch}
	}
	return StatusSent, map[string]interface{}{
		"channel": ch,
		"target":  target,
		"subject": subject,
		"size":    len(content),
	}
}
