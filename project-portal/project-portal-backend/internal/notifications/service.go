package notifications

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"carbon-scribe/project-portal/project-portal-backend/internal/notifications"
	"carbon-scribe/project-portal/project-portal-backend/internal/notifications/websocket"
)

// Service provides notification business logic
type Service struct {
	db                *gorm.DB
	wsManager         *websocket.Manager
	emailChannel      *EmailChannel
	smsChannel        *SMSChannel
	templateManager   *TemplateManager
	preferenceManager *PreferenceManager
	ruleEngine        *RuleEngine
}

// ServiceConfig contains service configuration
type ServiceConfig struct {
	DatabaseURL      string `json:"database_url"`
	SMSTemplateDir   string `json:"sms_template_dir"`
	EmailTemplateDir string `json:"email_template_dir"`
	SMSProvider      string `json:"sms_provider"`
	EmailProvider    string `json:"email_provider"`
}

// NewService creates a new notification service
func NewService(db *gorm.DB, wsManager *websocket.Manager, config *ServiceConfig) (*Service, error) {
	// Auto-migrate tables
	if err := db.AutoMigrate(
		&NotificationCategory{},
		&SentNotification{},
		&NotificationTemplate{},
		&NotificationRule{},
		&UserPreference{},
		&WebSocketConnection{},
		&DeliveryLog{},
	); err != nil {
		return nil, fmt.Errorf("failed to migrate database: %w", err)
	}

	// Initialize default categories
	if err := seedDefaultCategories(db); err != nil {
		log.Printf("Warning: failed to seed default categories: %v", err)
	}

	// Create sub-services
	templateManager := NewTemplateManager(db)
	preferenceManager := NewPreferenceManager(db)
	ruleEngine := NewRuleEngine(db, templateManager)
	emailChannel := NewEmailChannel(config.EmailProvider)
	smsChannel := NewSMSChannel(config.SMSProvider)

	return &Service{
		db:                db,
		wsManager:         wsManager,
		emailChannel:      emailChannel,
		smsChannel:        smsChannel,
		templateManager:   templateManager,
		preferenceManager: preferenceManager,
		ruleEngine:        ruleEngine,
	}, nil
}

// SendNotification sends a notification to a user
func (s *Service) SendNotification(ctx context.Context, req *NotificationRequest) (*NotificationResponse, error) {
	notificationID := uuid.New()

	// Get user preferences
	preferences, err := s.preferenceManager.GetUserPreferences(ctx, req.UserID.String())
	if err != nil {
		return nil, fmt.Errorf("failed to get user preferences: %w", err)
	}

	// Filter channels based on preferences
	enabledChannels := s.filterChannelsByPreferences(req.Channels, preferences, req.Category)

	// Check quiet hours
	if s.isQuietHours(preferences, req.Category) && req.Priority != PriorityCritical {
		// Schedule for later if not critical
		if req.ScheduledAt == nil {
			nextActiveTime := s.getNextActiveTime(preferences)
			req.ScheduledAt = &nextActiveTime
		}
	}

	// Create notification record
	notification := &SentNotification{
		ID:        notificationID,
		UserID:    req.UserID,
		Category:  s.getCategoryID(req.Category),
		Status:    StatusPending,
		Metadata:  s.convertMetadataToJSON(req.Metadata),
		CreatedAt: time.Now(),
	}

	if err := s.db.Create(notification).Error; err != nil {
		return nil, fmt.Errorf("failed to create notification record: %w", err)
	}

	// Send via enabled channels
	deliveryStatus := make(map[string]ChannelDeliveryStatus)

	for _, channel := range enabledChannels {
		status := s.sendViaChannel(ctx, channel, req, notificationID)
		deliveryStatus[channel] = status

		// Log delivery attempt
		s.logDeliveryAttempt(ctx, notificationID.String(), req.UserID.String(), channel, status)
	}

	// Update notification status based on delivery results
	overallStatus := s.calculateOverallStatus(deliveryStatus)
	notification.Status = overallStatus
	s.db.Save(notification)

	return &NotificationResponse{
		NotificationID: notificationID,
		Status:         overallStatus,
		Message:        "Notification processed",
		DeliveryStatus: deliveryStatus,
	}, nil
}

// sendViaChannel sends notification via a specific channel
func (s *Service) sendViaChannel(ctx context.Context, channel string, req *NotificationRequest, notificationID uuid.UUID) ChannelDeliveryStatus {
	status := ChannelDeliveryStatus{
		Channel: channel,
		Status:  StatusPending,
	}

	now := time.Now()
	status.SentAt = &now

	switch channel {
	case ChannelEmail:
		if err := s.emailChannel.Send(ctx, req); err != nil {
			status.Status = StatusFailed
			status.ErrorMessage = &[]string{err.Error()}[0]
		} else {
			status.Status = StatusSent
		}

	case ChannelSMS:
		if err := s.smsChannel.Send(ctx, req); err != nil {
			status.Status = StatusFailed
			status.ErrorMessage = &[]string{err.Error()}[0]
		} else {
			status.Status = StatusSent
		}

	case ChannelWebSocket:
		wsMessage := notifications.WebSocketMessage{
			Type:      notifications.WSMessageTypeNotification,
			Data:      s.convertMetadataToJSON(req.Metadata),
			Timestamp: time.Now(),
			Channel:   "private",
			Target:    req.UserID.String(),
		}

		if err := s.wsManager.SendToUser(req.UserID.String(), wsMessage); err != nil {
			status.Status = StatusFailed
			status.ErrorMessage = &[]string{err.Error()}[0]
		} else {
			status.Status = StatusDelivered
			deliveredAt := time.Now()
			status.DeliveredAt = &deliveredAt
		}

	case ChannelInApp:
		// In-app notifications are stored in the database
		status.Status = StatusDelivered
		deliveredAt := time.Now()
		status.DeliveredAt = &deliveredAt

	default:
		status.Status = StatusFailed
		status.ErrorMessage = &[]string{"Unsupported channel"}[0]
	}

	return status
}

// GetUserNotifications retrieves notifications for a user
func (s *Service) GetUserNotifications(ctx context.Context, userID uuid.UUID, limit, offset int) ([]SentNotification, error) {
	var notifications []SentNotification

	query := s.db.Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset)

	if err := query.Find(&notifications).Error; err != nil {
		return nil, fmt.Errorf("failed to get user notifications: %w", err)
	}

	return notifications, nil
}

// MarkNotificationAsRead marks a notification as read
func (s *Service) MarkNotificationAsRead(ctx context.Context, notificationID uuid.UUID) error {
	result := s.db.Model(&SentNotification{}).
		Where("id = ?", notificationID).
		Updates(map[string]interface{}{
			"opened_at": time.Now(),
		})

	if result.Error != nil {
		return fmt.Errorf("failed to mark notification as read: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("notification not found")
	}

	return nil
}

// GetNotificationStatus retrieves delivery status for a notification
func (s *Service) GetNotificationStatus(ctx context.Context, notificationID uuid.UUID) ([]DeliveryLog, error) {
	var logs []DeliveryLog

	if err := s.db.Where("notification_id = ?", notificationID.String()).
		Order("timestamp DESC").
		Find(&logs).Error; err != nil {
		return nil, fmt.Errorf("failed to get delivery logs: %w", err)
	}

	return logs, nil
}

// BroadcastMessage broadcasts a message to all connected users
func (s *Service) BroadcastMessage(ctx context.Context, message notifications.WebSocketMessage) error {
	return s.wsManager.Broadcast(message)
}

// SendToProject sends a message to all users in a project
func (s *Service) SendToProject(ctx context.Context, projectID string, message notifications.WebSocketMessage) error {
	return s.wsManager.SendToProject(projectID, message)
}

// GetNotificationMetrics retrieves delivery metrics
func (s *Service) GetNotificationMetrics(ctx context.Context, period string) (*NotificationMetrics, error) {
	metrics := &NotificationMetrics{
		Period:          period,
		ChannelMetrics:  make(map[string]ChannelMetrics),
		CategoryMetrics: make(map[string]CategoryMetrics),
	}

	// Calculate date range based on period
	startDate, endDate := s.getDateRangeForPeriod(period)

	// Get total counts
	var totalSent, totalDelivered, totalFailed int64

	s.db.Model(&SentNotification{}).
		Where("created_at BETWEEN ? AND ?", startDate, endDate).
		Count(&totalSent)

	s.db.Model(&SentNotification{}).
		Where("created_at BETWEEN ? AND ? AND status IN ?", startDate, endDate, []string{StatusDelivered}).
		Count(&totalDelivered)

	s.db.Model(&SentNotification{}).
		Where("created_at BETWEEN ? AND ? AND status IN ?", startDate, endDate, []string{StatusFailed}).
		Count(&totalFailed)

	metrics.TotalSent = totalSent
	metrics.TotalDelivered = totalDelivered
	metrics.TotalFailed = totalFailed

	if totalSent > 0 {
		metrics.DeliveryRate = float64(totalDelivered) / float64(totalSent)
	}

	// Get channel-specific metrics
	channels := []string{ChannelEmail, ChannelSMS, ChannelWebSocket, ChannelInApp}
	for _, channel := range channels {
		var sent, delivered, failed int64

		s.db.Model(&SentNotification{}).
			Where("created_at BETWEEN ? AND ? AND channel = ?", startDate, endDate, channel).
			Count(&sent)

		s.db.Model(&SentNotification{}).
			Where("created_at BETWEEN ? AND ? AND channel = ? AND status IN ?", startDate, endDate, channel, []string{StatusDelivered}).
			Count(&delivered)

		s.db.Model(&SentNotification{}).
			Where("created_at BETWEEN ? AND ? AND channel = ? AND status IN ?", startDate, endDate, channel, []string{StatusFailed}).
			Count(&failed)

		channelMetrics := ChannelMetrics{
			Sent:      sent,
			Delivered: delivered,
			Failed:    failed,
		}

		if sent > 0 {
			channelMetrics.Rate = float64(delivered) / float64(sent)
		}

		metrics.ChannelMetrics[channel] = channelMetrics
	}

	// Get category-specific metrics
	categories := []string{"MONITORING_ALERTS", "PAYMENT_UPDATES", "SYSTEM_ANNOUNCEMENTS", "PROJECT_UPDATES"}
	for _, category := range categories {
		var sent, delivered, failed int64

		// Join with notification categories to get category info
		query := `
			SELECT COUNT(*) 
			FROM sent_notifications sn
			JOIN notification_categories nc ON sn.category_id = nc.id
			WHERE sn.created_at BETWEEN ? AND ? AND nc.code = ?
		`

		s.db.Raw(query, startDate, endDate, category).Scan(&sent)

		// Similar queries for delivered and failed
		s.db.Raw(query+" AND sn.status IN ?", startDate, endDate, category, []string{StatusDelivered}).Scan(&delivered)
		s.db.Raw(query+" AND sn.status IN ?", startDate, endDate, category, []string{StatusFailed}).Scan(&failed)

		categoryMetrics := CategoryMetrics{
			Sent:      sent,
			Delivered: delivered,
			Failed:    failed,
		}

		if sent > 0 {
			categoryMetrics.Rate = float64(delivered) / float64(sent)
		}

		metrics.CategoryMetrics[category] = categoryMetrics
	}

	return metrics, nil
}

// Helper methods
func (s *Service) filterChannelsByPreferences(requestedChannels []string, preferences []UserPreference, category string) []string {
	if len(preferences) == 0 {
		return requestedChannels // No preferences set, use all requested channels
	}

	var enabledChannels []string
	for _, channel := range requestedChannels {
		// Check if user has enabled this channel for this category
		enabled := false
		for _, pref := range preferences {
			if pref.Channel == channel && pref.Category == category && pref.Enabled {
				enabled = true
				break
			}
		}

		if enabled {
			enabledChannels = append(enabledChannels, channel)
		}
	}

	return enabledChannels
}

func (s *Service) isQuietHours(preferences []UserPreference, category string) bool {
	now := time.Now()
	currentTime := now.Format("15:04")

	for _, pref := range preferences {
		if pref.Category == category && pref.QuietHoursStart != "" && pref.QuietHoursEnd != "" {
			// Simple time range check (ignores date boundaries for simplicity)
			if currentTime >= pref.QuietHoursStart && currentTime <= pref.QuietHoursEnd {
				return true
			}
		}
	}

	return false
}

func (s *Service) getNextActiveTime(preferences []UserPreference) time.Time {
	// For simplicity, return next hour
	return time.Now().Add(time.Hour)
}

func (s *Service) getCategoryID(categoryCode string) *uuid.UUID {
	var category NotificationCategory
	if err := s.db.Where("code = ?", categoryCode).First(&category).Error; err != nil {
		return nil
	}
	return &category.ID
}

func (s *Service) convertMetadataToJSON(metadata map[string]interface{}) gorm.DeletedAt {
	data, _ := json.Marshal(metadata)
	return gorm.DeletedAt{}
}

func (s *Service) logDeliveryAttempt(ctx context.Context, notificationID, userID, channel string, status ChannelDeliveryStatus) {
	log := &DeliveryLog{
		NotificationID:    notificationID,
		UserID:            userID,
		Channel:           channel,
		Status:            status.Status,
		ProviderMessageID: status.ProviderID,
		RetryCount:        0,
		Timestamp:         time.Now(),
	}

	if status.ErrorMessage != nil {
		log.FinalStatus = *status.ErrorMessage
	}

	s.db.Create(log)
}

func (s *Service) calculateOverallStatus(deliveryStatus map[string]ChannelDeliveryStatus) string {
	hasSuccess := false
	hasFailure := false

	for _, status := range deliveryStatus {
		switch status.Status {
		case StatusDelivered, StatusSent:
			hasSuccess = true
		case StatusFailed:
			hasFailure = true
		}
	}

	if hasFailure && !hasSuccess {
		return StatusFailed
	} else if hasSuccess {
		return StatusDelivered
	} else {
		return StatusPending
	}
}

func (s *Service) getDateRangeForPeriod(period string) (time.Time, time.Time) {
	now := time.Now()

	switch period {
	case "hour":
		return now.Add(-time.Hour), now
	case "day":
		return now.AddDate(0, 0, -1), now
	case "week":
		return now.AddDate(0, 0, -7), now
	case "month":
		return now.AddDate(0, -1, 0), now
	default:
		return now.AddDate(0, 0, -1), now
	}
}

// seedDefaultCategories creates default notification categories
func seedDefaultCategories(db *gorm.DB) error {
	for _, category := range DefaultCategories {
		var existing NotificationCategory
		err := db.Where("code = ?", category.Code).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			if err := db.Create(&category).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

// Close closes the notification service
func (s *Service) Close() error {
	if s.wsManager != nil {
		s.wsManager.Close()
	}
	return nil
}
