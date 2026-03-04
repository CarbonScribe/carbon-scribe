package collaboration

import (
	"time"

	"gorm.io/gorm"
)

// Role definitions
const (
	RoleOwner       = "Owner"
	RoleManager     = "Manager"
	RoleContributor = "Contributor"
	RoleViewer      = "Viewer"
)

// ProjectMember represents a user's membership in a project
type ProjectMember struct {
	ID          string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	ProjectID   string         `gorm:"index;not null" json:"project_id"`
	UserID      string         `gorm:"index;not null" json:"user_id"`
	Role        string         `gorm:"not null" json:"role"`
	Permissions []string       `gorm:"type:text[]" json:"permissions"`
	JoinedAt    time.Time      `json:"joined_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// ProjectInvitation represents a pending invitation
type ProjectInvitation struct {
	ID        string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	ProjectID string         `gorm:"index;not null" json:"project_id"`
	Email     string         `gorm:"index;not null" json:"email"`
	Role      string         `gorm:"not null" json:"role"`
	Token     string         `gorm:"uniqueIndex;not null" json:"-"`
	Status    string         `gorm:"default:'pending'" json:"status"` // pending, accepted, expired
	ExpiresAt time.Time      `json:"expires_at"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// ActivityLog represents an event in the project
type ActivityLog struct {
	ID        string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	ProjectID string         `gorm:"index;not null" json:"project_id"`
	UserID    string         `gorm:"index" json:"user_id,omitempty"` // Nullable for system events
	Type      string         `gorm:"index;not null" json:"type"`     // system, user, automated, alert
	Action    string         `gorm:"not null" json:"action"`         // e.g., "upload_document", "status_change"
	Metadata  map[string]any `gorm:"serializer:json" json:"metadata"`
	CreatedAt time.Time      `gorm:"index" json:"created_at"`
}

// Comment represents a comment on a project or resource
type Comment struct {
	ID          string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	ProjectID   string         `gorm:"index;not null" json:"project_id"`
	UserID      string         `gorm:"index;not null" json:"user_id"`
	ResourceID  *string        `gorm:"index" json:"resource_id,omitempty"` // Optional link to specific resource
	ParentID    *string        `gorm:"index" json:"parent_id,omitempty"`   // For threading
	Content     string         `gorm:"type:text;not null" json:"content"`
	Mentions    []string       `gorm:"type:text[]" json:"mentions"`               // Array of User IDs
	Attachments []string       `gorm:"type:text[]" json:"attachments"`            // Array of URLs
	Location    map[string]any `gorm:"serializer:json" json:"location,omitempty"` // For map coordinates/annotations
	IsResolved  bool           `gorm:"default:false" json:"is_resolved"`
	ResolvedBy  *string        `json:"resolved_by,omitempty"`
	ResolvedAt  *time.Time     `json:"resolved_at,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// Task represents a unit of work
type Task struct {
	ID          string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	ProjectID   string         `gorm:"index;not null" json:"project_id"`
	AssignedTo  *string        `gorm:"index" json:"assigned_to,omitempty"`
	CreatedBy   string         `gorm:"not null" json:"created_by"`
	Title       string         `gorm:"not null" json:"title"`
	Description string         `gorm:"type:text" json:"description"`
	Status      string         `gorm:"index;default:'todo'" json:"status"` // todo, in_progress, review, done
	Priority    string         `gorm:"default:'medium'" json:"priority"`   // low, medium, high, urgent
	DueDate     *time.Time     `gorm:"index" json:"due_date,omitempty"`
	TimeLogged  int64          `gorm:"default:0" json:"time_logged"` // in seconds
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// TaskDependency represents a relationship between tasks
type TaskDependency struct {
	ID              string `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	TaskID          string `gorm:"index;not null" json:"task_id"`
	DependsOnTaskID string `gorm:"index;not null" json:"depends_on_task_id"`
	Type            string `gorm:"default:'blocking'" json:"type"`
}

// SharedResource represents a file, link, or equipment
type SharedResource struct {
	ID         string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	ProjectID  string         `gorm:"index;not null" json:"project_id"`
	Type       string         `gorm:"not null" json:"type"` // document, equipment, contact, template, link
	Name       string         `gorm:"not null" json:"name"`
	URL        string         `json:"url,omitempty"`
	Metadata   map[string]any `gorm:"serializer:json" json:"metadata"`
	UploadedBy string         `json:"uploaded_by"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

// ResourceBooking represents a reservation for a shared resource (e.g. equipment)
type ResourceBooking struct {
	ID         string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	ResourceID string    `gorm:"index;not null" json:"resource_id"`
	BookedBy   string    `gorm:"index;not null" json:"booked_by"`
	StartTime  time.Time `gorm:"index;not null" json:"start_time"`
	EndTime    time.Time `gorm:"index;not null" json:"end_time"`
	Status     string    `gorm:"default:'confirmed'" json:"status"`
	CreatedAt  time.Time `json:"created_at"`
}
