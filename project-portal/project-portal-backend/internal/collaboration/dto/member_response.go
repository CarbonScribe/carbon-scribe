package dto

import "time"

// EnrichedProjectMemberResponse is the enriched response type for project members
// Includes user profile fields for frontend rendering
// Backward compatible: keeps user_id and role

type EnrichedProjectMemberResponse struct {
	UserID      string    `json:"user_id"`
	DisplayName string    `json:"display_name"`
	Email       string    `json:"email"`
	AvatarURL   string    `json:"avatar_url"`
	Phone       string    `json:"phone,omitempty"`
	Location    string    `json:"location,omitempty"`
	Title       string    `json:"title,omitempty"`
	Bio         string    `json:"bio,omitempty"`
	Role        string    `json:"role"`
	JoinedAt    time.Time `json:"joined_at"`
}
