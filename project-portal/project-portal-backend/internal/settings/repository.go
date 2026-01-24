package settings

import (
	"context"
	"database/sql"
)

type Repository interface {
	GetProfile(ctx context.Context, userID string) (*UserProfile, error)
	UpdateProfile(ctx context.Context, profile *UserProfile) error

	GetNotifications(ctx context.Context, userID string) (*NotificationPreferences, error)
	UpdateNotifications(ctx context.Context, prefs *NotificationPreferences) error
}

// Repository handles all database operations for settings
type RepositoryImpl struct {
	db *sql.DB
}

// NewRepository creates a new settings repository
func NewRepository(db *sql.DB) *RepositoryImpl {
	return &RepositoryImpl{db: db} // MUST return pointer
}
