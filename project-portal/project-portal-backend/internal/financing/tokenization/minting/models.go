package minting

import (
	"time"

	"github.com/google/uuid"
)

// MintingJob represents a job for minting carbon credits
type MintingJob struct {
	ID             uuid.UUID  `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ProjectID      uuid.UUID  `json:"project_id" gorm:"not null"`
	VerificationID *uuid.UUID `json:"verification_id"`
	Status         string     `json:"status" gorm:"default:'pending'"` // pending, processing, completed, failed
	TxHash         string     `json:"tx_hash"`
	Error          string     `json:"error"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// MintedToken represents a unique carbon credit token that has been minted
type MintedToken struct {
	ID      uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	JobID   uuid.UUID `json:"job_id" gorm:"not null"`
	TokenID int       `json:"token_id" gorm:"not null"`
	// TxHash is the Soroban transaction hash the token was minted in. It is
	// always populated — for the mock contract client it carries the
	// "MOCK_TX_HASH_" prefixed placeholder, never a blank value.
	TxHash string `json:"tx_hash" gorm:"not null"`
	// IsMock marks a token minted through the explicit, non-production-only
	// mock contract client, so mock data can never be mistaken for a real
	// on-chain mint. Always false for tokens minted in production.
	IsMock        bool      `json:"is_mock" gorm:"not null;default:false"`
	ProjectID     uuid.UUID `json:"project_id" gorm:"not null"`
	VintageYear   int       `json:"vintage_year" gorm:"not null"`
	MethodologyID int       `json:"methodology_id" gorm:"not null"`
	// Network is the Stellar network passphrase this token was minted
	// under (#794) — e.g. "Test SDF Network ; September 2015" or
	// "Public Global Stellar Network ; September 2015" — so it's clear
	// later which ledger TxHash belongs to.
	Network string `json:"network"`
	// OwnerAddress is the Stellar account the token was minted to — the
	// project's own registered wallet, never the minting authority's own
	// key (#793).
	OwnerAddress string    `json:"owner_address"`
	CreatedAt    time.Time `json:"created_at"`
}

// ManualMintRequest represents the request to manually trigger minting
type ManualMintRequest struct {
	VerificationID *uuid.UUID `json:"verification_id,omitempty"`
}

// MintingStatusResponse represents the response with minting job status
type MintingStatusResponse struct {
	Jobs   []MintingJob  `json:"jobs"`
	Tokens []MintedToken `json:"tokens"`
}
