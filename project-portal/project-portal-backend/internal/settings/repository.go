package settings

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository interface {
	GetOrCreateProfile(ctx context.Context, userID uuid.UUID) (*UserProfile, error)
	SaveProfile(ctx context.Context, profile *UserProfile) error
	DeleteProfileData(ctx context.Context, userID uuid.UUID) error
	GetOrCreateNotificationPreferences(ctx context.Context, userID uuid.UUID) (*NotificationPreference, error)
	SaveNotificationPreferences(ctx context.Context, prefs *NotificationPreference) error
	ListAPIKeys(ctx context.Context, userID uuid.UUID) ([]APIKey, error)
	CreateAPIKey(ctx context.Context, key *APIKey) error
	GetAPIKey(ctx context.Context, userID, keyID uuid.UUID) (*APIKey, error)
	ListAPIKeysByPrefix(ctx context.Context, keyPrefix string) ([]APIKey, error)
	SaveAPIKey(ctx context.Context, key *APIKey) error
	ListIntegrations(ctx context.Context, userID uuid.UUID) ([]IntegrationConfiguration, error)
	GetIntegration(ctx context.Context, userID, integrationID uuid.UUID) (*IntegrationConfiguration, error)
	UpsertIntegration(ctx context.Context, integration *IntegrationConfiguration) error
	GetSubscription(ctx context.Context, userID uuid.UUID) (*Subscription, error)
	SaveSubscription(ctx context.Context, sub *Subscription) error
	ListInvoices(ctx context.Context, userID uuid.UUID, limit int) ([]Invoice, error)
	GetInvoice(ctx context.Context, userID, invoiceID uuid.UUID) (*Invoice, error)
	SaveInvoice(ctx context.Context, invoice *Invoice) error
}

type repository struct{ db *gorm.DB }

func NewRepository(db *gorm.DB) Repository { return &repository{db: db} }

func (r *repository) GetOrCreateProfile(ctx context.Context, userID uuid.UUID) (*UserProfile, error) {
	profile := &UserProfile{}
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).First(profile).Error
	if err == nil {
		return profile, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	profile = &UserProfile{
		ID:                uuid.New(),
		UserID:            userID,
		Language:          "en",
		Timezone:          "UTC",
		Currency:          "USD",
		DateFormat:        "YYYY-MM-DD",
		VerificationLevel: "basic",
	}
	if err := r.db.WithContext(ctx).Create(profile).Error; err != nil {
		return nil, err
	}
	return profile, nil
}

func (r *repository) SaveProfile(ctx context.Context, profile *UserProfile) error {
	return r.db.WithContext(ctx).Save(profile).Error
}

func (r *repository) DeleteProfileData(ctx context.Context, userID uuid.UUID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ?", userID).Delete(&Invoice{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", userID).Delete(&Subscription{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", userID).Delete(&IntegrationConfiguration{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", userID).Delete(&APIKey{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", userID).Delete(&NotificationPreference{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", userID).Delete(&UserProfile{}).Error; err != nil {
			return err
		}
		return nil
	})
}

func (r *repository) GetOrCreateNotificationPreferences(ctx context.Context, userID uuid.UUID) (*NotificationPreference, error) {
	prefs := &NotificationPreference{}
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).First(prefs).Error
	if err == nil {
		return prefs, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	prefs = &NotificationPreference{
		ID:                     uuid.New(),
		UserID:                 userID,
		EmailEnabled:           true,
		SMSSEnabled:            false,
		PushEnabled:            true,
		InAppEnabled:           true,
		Categories:             defaultNotificationCategories(),
		QuietHoursEnabled:      false,
		QuietHoursStart:        "22:00:00",
		QuietHoursEnd:          "08:00:00",
		QuietHoursTimezone:     "UTC",
		EmergencyOverride:      true,
		EmergencySeverityLevel: "critical",
	}
	if err := r.db.WithContext(ctx).Create(prefs).Error; err != nil {
		return nil, err
	}
	return prefs, nil
}

func (r *repository) SaveNotificationPreferences(ctx context.Context, prefs *NotificationPreference) error {
	return r.db.WithContext(ctx).Save(prefs).Error
}

func (r *repository) ListAPIKeys(ctx context.Context, userID uuid.UUID) ([]APIKey, error) {
	var keys []APIKey
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).Order("created_at desc").Find(&keys).Error
	return keys, err
}

func (r *repository) CreateAPIKey(ctx context.Context, key *APIKey) error {
	return r.db.WithContext(ctx).Create(key).Error
}

func (r *repository) GetAPIKey(ctx context.Context, userID, keyID uuid.UUID) (*APIKey, error) {
	var key APIKey
	if err := r.db.WithContext(ctx).Where("id = ? AND user_id = ?", keyID, userID).First(&key).Error; err != nil {
		return nil, err
	}
	return &key, nil
}

func (r *repository) SaveAPIKey(ctx context.Context, key *APIKey) error {
	return r.db.WithContext(ctx).Save(key).Error
}

func (r *repository) ListAPIKeysByPrefix(ctx context.Context, keyPrefix string) ([]APIKey, error) {
	var keys []APIKey
	err := r.db.WithContext(ctx).
		Where("key_prefix = ?", keyPrefix).
		Where("is_active = ?", true).
		Order("created_at desc").
		Find(&keys).Error
	return keys, err
}

func (r *repository) ListIntegrations(ctx context.Context, userID uuid.UUID) ([]IntegrationConfiguration, error) {
	var integrations []IntegrationConfiguration
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("updated_at desc").
		Find(&integrations).Error
	return integrations, err
}

func (r *repository) GetIntegration(ctx context.Context, userID, integrationID uuid.UUID) (*IntegrationConfiguration, error) {
	var integration IntegrationConfiguration
	if err := r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", integrationID, userID).
		First(&integration).Error; err != nil {
		return nil, err
	}
	return &integration, nil
}

func (r *repository) UpsertIntegration(ctx context.Context, integration *IntegrationConfiguration) error {
	var existing IntegrationConfiguration
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND integration_type = ? AND integration_name = ?",
			integration.UserID, integration.IntegrationType, integration.IntegrationName).
		First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return r.db.WithContext(ctx).Create(integration).Error
	}
	if err != nil {
		return err
	}
	integration.ID = existing.ID
	integration.CreatedAt = existing.CreatedAt
	return r.db.WithContext(ctx).Save(integration).Error
}

func (r *repository) GetSubscription(ctx context.Context, userID uuid.UUID) (*Subscription, error) {
	var sub Subscription
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&sub).Error
	if err == nil {
		return &sub, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	now := time.Now().UTC()
	sub = Subscription{
		ID:                 uuid.New(),
		UserID:             userID,
		PlanID:             "free",
		PlanName:           "Free",
		BillingCycle:       "monthly",
		Status:             "active",
		CurrentPeriodStart: now,
		CurrentPeriodEnd:   now.AddDate(0, 1, 0),
	}
	if err := r.db.WithContext(ctx).Create(&sub).Error; err != nil {
		return nil, err
	}
	return &sub, nil
}

func (r *repository) SaveSubscription(ctx context.Context, sub *Subscription) error {
	return r.db.WithContext(ctx).Save(sub).Error
}

func (r *repository) ListInvoices(ctx context.Context, userID uuid.UUID, limit int) ([]Invoice, error) {
	var invoices []Invoice
	q := r.db.WithContext(ctx).Where("user_id = ?", userID).Order("created_at desc")
	if limit > 0 {
		q = q.Limit(limit)
	}
	if err := q.Find(&invoices).Error; err != nil {
		return nil, err
	}
	return invoices, nil
}

func (r *repository) GetInvoice(ctx context.Context, userID, invoiceID uuid.UUID) (*Invoice, error) {
	var invoice Invoice
	if err := r.db.WithContext(ctx).Where("id = ? AND user_id = ?", invoiceID, userID).First(&invoice).Error; err != nil {
		return nil, err
	}
	return &invoice, nil
}

func (r *repository) SaveInvoice(ctx context.Context, invoice *Invoice) error {
	return r.db.WithContext(ctx).Save(invoice).Error
}
