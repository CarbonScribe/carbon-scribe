package methodology

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

const DefaultMethodologyContractID = "CDQXMVTNCAN4KKPFOAMAAKU4B7LNNQI7F6EX2XIGKVNPJPKGWGM35BTP"

// MethodologyMeta mirrors the metadata shape stored in the Methodology Library contract.
type MethodologyMeta struct {
	Name             string `json:"name"`
	Version          string `json:"version"`
	Registry         string `json:"registry"`
	RegistryLink     string `json:"registry_link"`
	IssuingAuthority string `json:"issuing_authority"`
	IPFSCID          string `json:"ipfs_cid,omitempty"`
}

// MethodologyRegistration captures methodology NFT mapping to a project.
type MethodologyRegistration struct {
	ID                   uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	ProjectID            uuid.UUID `json:"project_id" gorm:"type:uuid;not null;index"`
	MethodologyTokenID   int       `json:"methodology_token_id" gorm:"not null;index"`
	ContractID           string    `json:"contract_id" gorm:"size:56;not null"`
	Name                 string    `json:"name" gorm:"size:255;not null"`
	Version              string    `json:"version" gorm:"size:100"`
	Registry             string    `json:"registry" gorm:"size:100"`
	RegistryLink         string    `json:"registry_link" gorm:"size:500"`
	IssuingAuthority     string    `json:"issuing_authority" gorm:"size:56"`
	OwnerAddress         string    `json:"owner_address" gorm:"size:56"`
	IPFSCID              string    `json:"ipfs_cid" gorm:"size:255"`
	RegisteredAt         time.Time `json:"registered_at"`
	TransactionHash      string    `json:"tx_hash" gorm:"column:tx_hash;size:128"`
	MethodologyValidated bool      `json:"methodology_verified" gorm:"column:methodology_verified;default:true"`
}

func (m *MethodologyRegistration) BeforeCreate(tx *gorm.DB) (err error) {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}

func (MethodologyRegistration) TableName() string {
	return "methodology_registrations"
}

type RegisterMethodologyRequest struct {
	Name             string `json:"name" binding:"required"`
	Version          string `json:"version"`
	Registry         string `json:"registry" binding:"required"`
	RegistryLink     string `json:"registry_link"`
	IssuingAuthority string `json:"issuing_authority" binding:"required"`
	OwnerAddress     string `json:"owner_address" binding:"required"`
	IPFSCID          string `json:"ipfs_cid"`
}

type MethodologyRegistrationResponse struct {
	ID                  uuid.UUID `json:"id"`
	ProjectID           uuid.UUID `json:"project_id"`
	MethodologyTokenID  int       `json:"methodology_token_id"`
	ContractID          string    `json:"contract_id"`
	Name                string    `json:"name"`
	Version             string    `json:"version"`
	Registry            string    `json:"registry"`
	RegistryLink        string    `json:"registry_link"`
	IssuingAuthority    string    `json:"issuing_authority"`
	OwnerAddress        string    `json:"owner_address"`
	IPFSCID             string    `json:"ipfs_cid,omitempty"`
	RegisteredAt        time.Time `json:"registered_at"`
	TransactionHash     string    `json:"tx_hash,omitempty"`
	MethodologyVerified bool      `json:"methodology_verified"`
}

type ValidateMethodologyResponse struct {
	TokenID    int    `json:"token_id"`
	ContractID string `json:"contract_id"`
	Valid      bool   `json:"valid"`
}

const (
	CapSourceContract   = "CONTRACT"
	CapSourceAdmin      = "ADMIN"
	CapSourceRegistry   = "REGISTRY"
	CapSourceOracle     = "ORACLE"
	CapSourceGovernance = "GOVERNANCE"
)

type MethodologyCap struct {
	ID                 uuid.UUID  `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	MethodologyTokenID int        `json:"methodology_token_id" gorm:"uniqueIndex;not null"`
	MaxSupply          int64      `json:"max_supply" gorm:"not null"`
	CurrentSupply      int64      `json:"current_supply" gorm:"not null;default:0"`
	CapPerProject      *int64     `json:"cap_per_project,omitempty"`
	CapPerVintage      *int64     `json:"cap_per_vintage,omitempty"`
	EffectiveFrom      time.Time  `json:"effective_from"`
	EffectiveTo        *time.Time `json:"effective_to,omitempty"`
	CreatedBy          string     `json:"created_by,omitempty" gorm:"size:56"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

func (MethodologyCap) TableName() string {
	return "methodology_caps"
}

func (m *MethodologyCap) BeforeCreate(tx *gorm.DB) (err error) {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if m.EffectiveFrom.IsZero() {
		m.EffectiveFrom = time.Now().UTC()
	}
	return nil
}

type MintingAttempt struct {
	ID                  uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	MethodologyTokenID  int       `json:"methodology_token_id" gorm:"not null;index"`
	ProjectID           uuid.UUID `json:"project_id" gorm:"type:uuid;not null;index"`
	RequestedAmount     int64     `json:"requested_amount" gorm:"not null"`
	Approved            bool      `json:"approved" gorm:"not null"`
	RejectionReason     string    `json:"rejection_reason,omitempty"`
	CurrentSupplyBefore *int64    `json:"current_supply_before,omitempty"`
	CurrentSupplyAfter  *int64    `json:"current_supply_after,omitempty"`
	VintageYear         *int      `json:"vintage_year,omitempty"`
	AttemptedAt         time.Time `json:"attempted_at"`
}

func (MintingAttempt) TableName() string {
	return "minting_attempts"
}

func (m *MintingAttempt) BeforeCreate(tx *gorm.DB) (err error) {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if m.AttemptedAt.IsZero() {
		m.AttemptedAt = time.Now().UTC()
	}
	return nil
}

type CapConfigurationSource struct {
	ID                 uuid.UUID      `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	MethodologyTokenID int            `json:"methodology_token_id" gorm:"not null;index"`
	SourceType         string         `json:"source_type" gorm:"size:50;not null"`
	SourceReference    string         `json:"source_reference,omitempty"`
	CapConfiguration   datatypes.JSON `json:"cap_configuration" gorm:"type:jsonb;not null"`
	AppliedAt          time.Time      `json:"applied_at"`
}

func (CapConfigurationSource) TableName() string {
	return "cap_configuration_sources"
}

func (c *CapConfigurationSource) BeforeCreate(tx *gorm.DB) (err error) {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	if c.AppliedAt.IsZero() {
		c.AppliedAt = time.Now().UTC()
	}
	return nil
}

type MethodologySupplyResponse struct {
	MethodologyTokenID int   `json:"methodology_token_id"`
	MaxSupply          int64 `json:"max_supply"`
	CurrentSupply      int64 `json:"current_supply"`
	RemainingSupply    int64 `json:"remaining_supply"`
	NearLimit          bool  `json:"near_limit"`
	NearLimitThreshold int64 `json:"near_limit_threshold"`
}

type MethodologyCapRequest struct {
	MaxSupply     int64  `json:"max_supply" binding:"required,gt=0"`
	CapPerProject *int64 `json:"cap_per_project,omitempty" binding:"omitempty,gt=0"`
	CapPerVintage *int64 `json:"cap_per_vintage,omitempty" binding:"omitempty,gt=0"`
	EffectiveFrom string `json:"effective_from,omitempty"`
	EffectiveTo   string `json:"effective_to,omitempty"`
	SourceType    string `json:"source_type,omitempty"`
	SourceRef     string `json:"source_reference,omitempty"`
	CreatedBy     string `json:"created_by,omitempty"`
}

type MintingValidationHistoryResponse struct {
	ProjectID uuid.UUID        `json:"project_id"`
	Attempts  []MintingAttempt `json:"attempts"`
}
