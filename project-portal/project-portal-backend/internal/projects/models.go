package projects

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Project represents a carbon project
type Project struct {
	ID          uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name        string         `gorm:"not null" json:"name"`
	Description string         `json:"description"`
	Status      string         `gorm:"not null;default:'DRAFT'" json:"status"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	OwnerID     uuid.UUID      `gorm:"type:uuid;not null" json:"owner_id"`
	Geometry    datatypes.JSON `json:"geometry"` // GeoJSON
	Area        float64        `json:"area"`     // hectares
}

// ProjectStatusHistory tracks status changes
type ProjectStatusHistory struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProjectID uuid.UUID `gorm:"type:uuid;not null" json:"project_id"`
	Status    string    `gorm:"not null" json:"status"`
	ChangedAt time.Time `json:"changed_at"`
	ChangedBy uuid.UUID `gorm:"type:uuid;not null" json:"changed_by"`
	Project   Project   `gorm:"foreignKey:ProjectID"`
}

// ProjectTeamMember represents team members on a project
type ProjectTeamMember struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProjectID uuid.UUID `gorm:"type:uuid;not null" json:"project_id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null" json:"user_id"`
	Role      string    `gorm:"not null" json:"role"`
	JoinedAt  time.Time `json:"joined_at"`
	Project   Project   `gorm:"foreignKey:ProjectID"`
}

// ProjectActivity logs activities on the project
type ProjectActivity struct {
	ID           uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProjectID    uuid.UUID `gorm:"type:uuid;not null" json:"project_id"`
	ActivityType string    `gorm:"not null" json:"activity_type"`
	Description  string    `json:"description"`
	CreatedAt    time.Time `json:"created_at"`
	UserID       uuid.UUID `gorm:"type:uuid;not null" json:"user_id"`
	Project      Project   `gorm:"foreignKey:ProjectID"`
}

// ProjectTag for tagging projects
type ProjectTag struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProjectID uuid.UUID `gorm:"type:uuid;not null" json:"project_id"`
	Tag       string    `gorm:"not null" json:"tag"`
	Project   Project   `gorm:"foreignKey:ProjectID"`
}

// ProjectComment for comments on projects
type ProjectComment struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProjectID uuid.UUID `gorm:"type:uuid;not null" json:"project_id"`
	Comment   string    `gorm:"not null" json:"comment"`
	CreatedAt time.Time `json:"created_at"`
	UserID    uuid.UUID `gorm:"type:uuid;not null" json:"user_id"`
	Project   Project   `gorm:"foreignKey:ProjectID"`
}