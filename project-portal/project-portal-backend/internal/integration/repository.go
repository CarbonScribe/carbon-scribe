package integration

import (
	"context"
	"time"

	"gorm.io/gorm"
)

type Repository interface {
	// Connection
	CreateConnection(ctx context.Context, conn *IntegrationConnection) error
	GetConnection(ctx context.Context, id string) (*IntegrationConnection, error)
	GetConnectionByProvider(ctx context.Context, provider string) (*IntegrationConnection, error)
	ListConnections(ctx context.Context) ([]IntegrationConnection, error)
	UpdateConnection(ctx context.Context, conn *IntegrationConnection) error
	DeleteConnection(ctx context.Context, id string) error

	// Webhook Config
	CreateWebhookConfig(ctx context.Context, webhook *WebhookConfig) error
	ListWebhookConfigs(ctx context.Context, projectID *string) ([]WebhookConfig, error)
	GetWebhookConfig(ctx context.Context, id string) (*WebhookConfig, error)

	// Webhook Delivery
	CreateWebhookDelivery(ctx context.Context, delivery *WebhookDelivery) error
	UpdateWebhookDelivery(ctx context.Context, delivery *WebhookDelivery) error

	// Event Subscription
	CreateSubscription(ctx context.Context, sub *EventSubscription) error
	ListSubscriptions(ctx context.Context, eventType string) ([]EventSubscription, error)

	// OAuth Token
	SaveOAuthToken(ctx context.Context, token *OAuthToken) error
	GetOAuthToken(ctx context.Context, connectionID string) (*OAuthToken, error)

	// OAuth State (authorization-code + PKCE flow)
	CreateOAuthState(ctx context.Context, state *OAuthState) error
	GetOAuthStateByState(ctx context.Context, state string) (*OAuthState, error)
	MarkOAuthStateConsumed(ctx context.Context, state string) error
	DeleteExpiredOAuthStates(ctx context.Context, before time.Time) error

	// Health
	RecordHealth(ctx context.Context, health *IntegrationHealth) error
	GetLatestHealth(ctx context.Context, connectionID string) (*IntegrationHealth, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// Connection

func (r *repository) CreateConnection(ctx context.Context, conn *IntegrationConnection) error {
	return r.db.WithContext(ctx).Create(conn).Error
}

func (r *repository) GetConnection(ctx context.Context, id string) (*IntegrationConnection, error) {
	var conn IntegrationConnection
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&conn).Error; err != nil {
		return nil, err
	}
	return &conn, nil
}

func (r *repository) GetConnectionByProvider(ctx context.Context, provider string) (*IntegrationConnection, error) {
	var conn IntegrationConnection
	if err := r.db.WithContext(ctx).Where("provider = ?", provider).Order("created_at desc").First(&conn).Error; err != nil {
		return nil, err
	}
	return &conn, nil
}

func (r *repository) ListConnections(ctx context.Context) ([]IntegrationConnection, error) {
	var conns []IntegrationConnection
	if err := r.db.WithContext(ctx).Find(&conns).Error; err != nil {
		return nil, err
	}
	return conns, nil
}

func (r *repository) UpdateConnection(ctx context.Context, conn *IntegrationConnection) error {
	return r.db.WithContext(ctx).Save(conn).Error
}

func (r *repository) DeleteConnection(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&IntegrationConnection{}, "id = ?", id).Error
}

// Webhook Config

func (r *repository) CreateWebhookConfig(ctx context.Context, webhook *WebhookConfig) error {
	return r.db.WithContext(ctx).Create(webhook).Error
}

func (r *repository) ListWebhookConfigs(ctx context.Context, projectID *string) ([]WebhookConfig, error) {
	var webhooks []WebhookConfig
	query := r.db.WithContext(ctx)
	if projectID != nil {
		query = query.Where("project_id = ?", *projectID)
	}
	if err := query.Find(&webhooks).Error; err != nil {
		return nil, err
	}
	return webhooks, nil
}

func (r *repository) GetWebhookConfig(ctx context.Context, id string) (*WebhookConfig, error) {
	var webhook WebhookConfig
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&webhook).Error; err != nil {
		return nil, err
	}
	return &webhook, nil
}

// Webhook Delivery

func (r *repository) CreateWebhookDelivery(ctx context.Context, delivery *WebhookDelivery) error {
	return r.db.WithContext(ctx).Create(delivery).Error
}

func (r *repository) UpdateWebhookDelivery(ctx context.Context, delivery *WebhookDelivery) error {
	return r.db.WithContext(ctx).Save(delivery).Error
}

// Event Subscription

func (r *repository) CreateSubscription(ctx context.Context, sub *EventSubscription) error {
	return r.db.WithContext(ctx).Create(sub).Error
}

func (r *repository) ListSubscriptions(ctx context.Context, eventType string) ([]EventSubscription, error) {
	var subs []EventSubscription
	if err := r.db.WithContext(ctx).Where("event_type = ?", eventType).Find(&subs).Error; err != nil {
		return nil, err
	}
	return subs, nil
}

// OAuth Token

func (r *repository) SaveOAuthToken(ctx context.Context, token *OAuthToken) error {
	return r.db.WithContext(ctx).Save(token).Error
}

func (r *repository) GetOAuthToken(ctx context.Context, connectionID string) (*OAuthToken, error) {
	var token OAuthToken
	if err := r.db.WithContext(ctx).Where("connection_id = ?", connectionID).First(&token).Error; err != nil {
		return nil, err
	}
	return &token, nil
}

// OAuth State

func (r *repository) CreateOAuthState(ctx context.Context, state *OAuthState) error {
	return r.db.WithContext(ctx).Create(state).Error
}

func (r *repository) GetOAuthStateByState(ctx context.Context, state string) (*OAuthState, error) {
	var s OAuthState
	if err := r.db.WithContext(ctx).Where("state = ?", state).First(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *repository) MarkOAuthStateConsumed(ctx context.Context, state string) error {
	return r.db.WithContext(ctx).Model(&OAuthState{}).Where("state = ?", state).Update("consumed", true).Error
}

func (r *repository) DeleteExpiredOAuthStates(ctx context.Context, before time.Time) error {
	return r.db.WithContext(ctx).Where("expires_at < ?", before).Delete(&OAuthState{}).Error
}

// Health

func (r *repository) RecordHealth(ctx context.Context, health *IntegrationHealth) error {
	return r.db.WithContext(ctx).Create(health).Error
}

func (r *repository) GetLatestHealth(ctx context.Context, connectionID string) (*IntegrationHealth, error) {
	var health IntegrationHealth
	if err := r.db.WithContext(ctx).Where("connection_id = ?", connectionID).Order("checked_at desc").First(&health).Error; err != nil {
		return nil, err
	}
	return &health, nil
}
