package settings

import (
	"context"
	"time"
)

type Service struct {
	repo *RepositoryImpl
}

func NewService(repo *RepositoryImpl) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetProfile(ctx context.Context, userID string) (*UserProfile, error) {
	return &UserProfile{
		UserID:   userID,
		Language: "en",
		Timezone: "UTC",
	}, nil
}

func (s *Service) UpdateProfile(ctx context.Context, profile *UserProfile) error {
	profile.UpdatedAt = time.Now()
	return nil
}

func (s *Service) GetNotifications(ctx context.Context, userID string) (*NotificationPreferences, error) {
	return &NotificationPreferences{
		UserID: userID,
		Channels: map[string]bool{
			"email": true,
			"push":  true,
		},
	}, nil
}

func (s *Service) UpdateNotifications(ctx context.Context, prefs *NotificationPreferences) error {
	prefs.UpdatedAt = time.Now()
	return nil
}
