package settings

import "time"

type UserProfile struct {
	UserID      string    `json:"user_id"`
	FullName    string    `json:"full_name"`
	DisplayName string    `json:"display_name"`
	Phone       string    `json:"phone"`
	Language    string    `json:"language"`
	Timezone    string    `json:"timezone"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type NotificationPreferences struct {
	UserID       string                 `json:"user_id"`
	Channels     map[string]bool        `json:"channels"`
	Categories   map[string]interface{} `json:"categories"`
	QuietEnabled bool                   `json:"quiet_enabled"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}

type APIKey struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Prefix    string    `json:"prefix"`
	LastUsed  time.Time `json:"last_used"`
	CreatedAt time.Time `json:"created_at"`
}

type IntegrationConfig struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Name     string `json:"name"`
	IsActive bool   `json:"is_active"`
}

type Subscription struct {
	Plan   string `json:"plan"`
	Status string `json:"status"`
}
