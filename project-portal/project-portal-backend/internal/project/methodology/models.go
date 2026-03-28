package methodology

import (
	"time"

	"github.com/google/uuid"
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
