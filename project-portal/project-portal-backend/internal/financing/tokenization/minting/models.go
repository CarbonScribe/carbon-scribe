package minting

import (
    "time"

    "github.com/google/uuid"
)

// MintingJob represents a job for minting carbon credits
type MintingJob struct {
    ID             uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
    ProjectID      uuid.UUID `json:"project_id" gorm:"not null"`
    VerificationID *uuid.UUID `json:"verification_id"`
    Status         string    `json:"status" gorm:"default:'pending'"` // pending, processing, completed, failed
    TxHash         string    `json:"tx_hash"`
    Error          string    `json:"error"`
    CreatedAt      time.Time `json:"created_at"`
    UpdatedAt      time.Time `json:"updated_at"`
}

// MintedToken represents a unique carbon credit token that has been minted
type MintedToken struct {
    ID             uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
    JobID          uuid.UUID `json:"job_id" gorm:"not null"`
    TokenID        int       `json:"token_id" gorm:"not null"`
    ProjectID      uuid.UUID `json:"project_id" gorm:"not null"`
    VintageYear    int       `json:"vintage_year" gorm:"not null"`
    MethodologyID  int       `json:"methodology_id" gorm:"not null"`
    CreatedAt      time.Time `json:"created_at"`
}

// ManualMintRequest represents the request to manually trigger minting
type ManualMintRequest struct {
    VerificationID *uuid.UUID `json:"verification_id,omitempty"`
}

// MintingStatusResponse represents the response with minting job status
type MintingStatusResponse struct {
    Jobs   []MintingJob   `json:"jobs"`
    Tokens []MintedToken  `json:"tokens"`
}
