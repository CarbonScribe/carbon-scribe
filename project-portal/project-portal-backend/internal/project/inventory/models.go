package inventory

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AssetStatus mirrors the Soroban contract's AssetStatus enum
type AssetStatus string

const (
	StatusIssued      AssetStatus = "Issued"
	StatusListed      AssetStatus = "Listed"
	StatusLocked      AssetStatus = "Locked"
	StatusRetired     AssetStatus = "Retired"
	StatusInvalidated AssetStatus = "Invalidated"
)

// ProjectCreditCache stores cached on-chain credit data
type ProjectCreditCache struct {
	ID            uuid.UUID   `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	ProjectID     uuid.UUID   `json:"project_id" gorm:"type:uuid;not null;index"`
	TokenID       uint32      `json:"token_id" gorm:"not null"`
	OwnerAddress  string      `json:"owner_address" gorm:"size:56;not null"`
	Status        AssetStatus `json:"status" gorm:"size:20"`
	VintageYear   uint64      `json:"vintage_year"`
	MethodologyID uint32      `json:"methodology_id"`
	QualityScore  int64       `json:"quality_score"`
	IsBurned      bool        `json:"is_burned" gorm:"default:false"`
	LastSynced    time.Time   `json:"last_synced" gorm:"default:now()"`
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
}

func (c *ProjectCreditCache) BeforeCreate(tx *gorm.DB) (err error) {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}

func (ProjectCreditCache) TableName() string {
	return "project_credit_cache"
}

// CreditMetadata represents on-chain carbon asset metadata
type CreditMetadata struct {
	ProjectID     string `json:"project_id"`
	VintageYear   uint64 `json:"vintage_year"`
	MethodologyID uint32 `json:"methodology_id"`
	GeoHash       string `json:"geo_hash"`
}

// Credit represents a single carbon credit with full details
type Credit struct {
	TokenID      uint32         `json:"token_id"`
	Owner        string         `json:"owner"`
	Status       AssetStatus    `json:"status"`
	QualityScore int64          `json:"quality_score"`
	IsBurned     bool           `json:"is_burned"`
	Metadata     CreditMetadata `json:"metadata"`
}

// InventorySummary provides aggregate credit statistics
type InventorySummary struct {
	ProjectID      uuid.UUID `json:"project_id"`
	TotalCredits   int64     `json:"total_credits"`
	ActiveCredits  int64     `json:"active_credits"`
	RetiredCredits int64     `json:"retired_credits"`
	LockedCredits  int64     `json:"locked_credits"`
	ListedCredits  int64     `json:"listed_credits"`
	LastSynced     time.Time `json:"last_synced"`
}

// CreditListResponse wraps a paginated list of credits
type CreditListResponse struct {
	Credits    []Credit `json:"credits"`
	Total      int64    `json:"total"`
	Limit      int      `json:"limit"`
	Offset     int      `json:"offset"`
	LastSynced time.Time `json:"last_synced"`
}

// CreditDetailResponse provides full credit details
type CreditDetailResponse struct {
	TokenID      uint32         `json:"token_id"`
	Owner        string         `json:"owner"`
	Status       AssetStatus    `json:"status"`
	QualityScore int64          `json:"quality_score"`
	IsBurned     bool           `json:"is_burned"`
	Metadata     CreditMetadata `json:"metadata"`
	LastSynced   time.Time      `json:"last_synced"`
}

// SyncStatus represents the sync state of the cache
type SyncStatus struct {
	ProjectID       uuid.UUID `json:"project_id"`
	LastSyncedAt    time.Time `json:"last_synced_at"`
	TokenCount      int64     `json:"token_count"`
	SyncInProgress  bool      `json:"sync_in_progress"`
	LastSyncError   string    `json:"last_sync_error,omitempty"`
}
