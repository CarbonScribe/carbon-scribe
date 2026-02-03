package project

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Project represents a carbon project
type Project struct {
	ID             uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name           string    `json:"name" gorm:"not null"`
	Type           string    `json:"type" gorm:"not null"` // e.g., Reforestation, Agroforestry
	Location       string    `json:"location" gorm:"not null"`
	Area           float64   `json:"area" gorm:"not null"` // in hectares
	StartDate      time.Time `json:"start_date"`
	Farmers        int       `json:"farmers"`
	CarbonCredits  int       `json:"carbon_credits"`
	Progress       int       `json:"progress"` // percentage
	Icon           string    `json:"icon"`
	Status         string    `json:"status" gorm:"default:'pending'"` // active, pending, completed
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (p *Project) BeforeCreate(tx *gorm.DB) (err error) {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return
}

// ProjectCreateRequest represents the request to create a project
type ProjectCreateRequest struct {
	Name          string  `json:"name" binding:"required"`
	Type          string  `json:"type" binding:"required"`
	Location      string  `json:"location" binding:"required"`
	Area          float64 `json:"area" binding:"required,min=0"`
	StartDate     string  `json:"start_date"` // ISO date string
	Farmers       int     `json:"farmers" binding:"min=0"`
	CarbonCredits int     `json:"carbon_credits" binding:"min=0"`
	Progress      int     `json:"progress" binding:"min=0,max=100"`
	Icon          string  `json:"icon"`
	Status        string  `json:"status"`
}

// ProjectUpdateRequest represents the request to update a project
type ProjectUpdateRequest struct {
	Name          *string  `json:"name,omitempty"`
	Type          *string  `json:"type,omitempty"`
	Location      *string  `json:"location,omitempty"`
	Area          *float64 `json:"area,omitempty"`
	StartDate     *string  `json:"start_date,omitempty"`
	Farmers       *int     `json:"farmers,omitempty"`
	CarbonCredits *int     `json:"carbon_credits,omitempty"`
	Progress      *int     `json:"progress,omitempty"`
	Icon          *string  `json:"icon,omitempty"`
	Status        *string  `json:"status,omitempty"`
}