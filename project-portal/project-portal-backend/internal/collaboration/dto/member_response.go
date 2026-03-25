package dto
 
import "time"
 
// EnrichedProjectMemberResponse is the API response for a project member,
// enriched with user profile data so the frontend can render member cards
// without making additional user-profile API calls.
type EnrichedProjectMemberResponse struct {
	// Core membership fields (backward-compatible with previous response)
	UserID    string    `json:"user_id"`
	Role      string    `json:"role"`
	JoinedAt  time.Time `json:"joined_at"`
	UpdatedAt time.Time `json:"updated_at"`
 
	// User profile fields
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
	AvatarURL   string `json:"avatar_url"`
 
	// Optional profile fields — omitted from JSON if empty
	Phone    string `json:"phone,omitempty"`
	Location string `json:"location,omitempty"`
	Title    string `json:"title,omitempty"`
	Bio      string `json:"bio,omitempty"`
}