package project

import (
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/project/methodology"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Project represents a carbon project
type Project struct {
	ID                    uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name                  string    `json:"name" gorm:"not null"`
	Type                  string    `json:"type" gorm:"not null"` // e.g., Reforestation, Agroforestry
	Location              string    `json:"location" gorm:"not null"`
	Area                  float64   `json:"area" gorm:"not null"` // in hectares
	StartDate             time.Time `json:"start_date"`
	Farmers               int       `json:"farmers"`
	CarbonCredits         int       `json:"carbon_credits"`
	Progress              int       `json:"progress"` // percentage
	Icon                  string    `json:"icon"`
	MethodologyTokenID    int       `json:"methodology_token_id" gorm:"column:methodology_token_id"`
	MethodologyContractID string    `json:"methodology_contract_id" gorm:"column:methodology_contract_id;size:56"`
	Status                string    `json:"status" gorm:"default:'pending'"` // active, pending, completed
	// StellarWalletAddress is the project's own registered Stellar account
	// (#793) — minted carbon credits are sent here, never to the minting
	// authority's own key. Nullable: a project without one registered
	// cannot be minted to until it is set.
	StellarWalletAddress *string   `json:"stellar_wallet_address,omitempty" gorm:"column:stellar_wallet_address;size:56"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
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
	Name               string                                  `json:"name" binding:"required"`
	Type               string                                  `json:"type" binding:"required"`
	Location           string                                  `json:"location" binding:"required"`
	Area               float64                                 `json:"area" binding:"required,min=0"`
	StartDate          string                                  `json:"start_date"` // ISO date string
	Farmers            int                                     `json:"farmers" binding:"min=0"`
	CarbonCredits      int                                     `json:"carbon_credits" binding:"min=0"`
	Progress           int                                     `json:"progress" binding:"min=0,max=100"`
	Icon               string                                  `json:"icon"`
	MethodologyTokenID int                                     `json:"methodology_token_id"`
	Methodology        *methodology.RegisterMethodologyRequest `json:"methodology,omitempty"`
	Status             string                                  `json:"status"`
	// StellarWalletAddress (#793), validated with keypair.ParseAddress.
	StellarWalletAddress string `json:"stellar_wallet_address,omitempty"`
}

// ProjectUpdateRequest represents the request to update a project
type ProjectUpdateRequest struct {
	Name                  *string  `json:"name,omitempty"`
	Type                  *string  `json:"type,omitempty"`
	Location              *string  `json:"location,omitempty"`
	Area                  *float64 `json:"area,omitempty"`
	StartDate             *string  `json:"start_date,omitempty"`
	Farmers               *int     `json:"farmers,omitempty"`
	CarbonCredits         *int     `json:"carbon_credits,omitempty"`
	Progress              *int     `json:"progress,omitempty"`
	Icon                  *string  `json:"icon,omitempty"`
	MethodologyTokenID    *int     `json:"methodology_token_id,omitempty"`
	MethodologyContractID *string  `json:"methodology_contract_id,omitempty"`
	Status                *string  `json:"status,omitempty"`
	// StellarWalletAddress (#793), validated with keypair.ParseAddress.
	StellarWalletAddress *string `json:"stellar_wallet_address,omitempty"`
}
