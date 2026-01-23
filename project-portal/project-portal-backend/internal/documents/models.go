package documents

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type DocumentStatus string

const (
	StatusDraft       DocumentStatus = "draft"
	StatusSubmitted   DocumentStatus = "submitted"
	StatusUnderReview DocumentStatus = "under_review"
	StatusApproved    DocumentStatus = "approved"
	StatusRejected    DocumentStatus = "rejected"
)

type DocumentType string

const (
	TypePDD                    DocumentType = "PDD"
	TypeMonitoringReport       DocumentType = "MONITORING_REPORT"
	TypeVerificationCertificate DocumentType = "VERIFICATION_CERTIFICATE"
)

type FileType string

const (
	FileTypePDF   FileType = "PDF"
	FileTypeDOCX  FileType = "DOCX"
	FileTypeXLSX  FileType = "XLSX"
	FileTypeImage FileType = "IMAGE"
	FileTypeZIP   FileType = "ZIP"
)

type StorageTier string

const (
	TierHot  StorageTier = "hot"
	TierWarm StorageTier = "warm"
	TierCold StorageTier = "cold"
)

type Document struct {
	ID             uuid.UUID       `json:"id" db:"id"`
	ProjectID      uuid.UUID       `json:"project_id" db:"project_id"`
	Name           string          `json:"name" db:"name"`
	Description    string          `json:"description" db:"description"`
	DocumentType   DocumentType    `json:"document_type" db:"document_type"`
	FileType       FileType        `json:"file_type" db:"file_type"`
	FileSize       int64           `json:"file_size" db:"file_size"`
	S3Key          string          `json:"s3_key" db:"s3_key"`
	S3Bucket       string          `json:"s3_bucket" db:"s3_bucket"`
	IPFSCID        *string         `json:"ipfs_cid,omitempty" db:"ipfs_cid"`
	StorageTier    StorageTier     `json:"storage_tier" db:"storage_tier"`
	CurrentVersion int             `json:"current_version" db:"current_version"`
	Status         DocumentStatus  `json:"status" db:"status"`
	WorkflowID     *uuid.UUID      `json:"workflow_id,omitempty" db:"workflow_id"`
	CurrentStep    int             `json:"current_step" db:"current_step"`
	DueAt          *time.Time      `json:"due_at,omitempty" db:"due_at"`
	UploadedBy     uuid.UUID       `json:"uploaded_by" db:"uploaded_by"`
	UploadedAt     time.Time       `json:"uploaded_at" db:"uploaded_at"`
	Metadata       json.RawMessage `json:"metadata" db:"metadata"`
}

type WorkflowStep struct {
	Role   string `json:"role"`
	Action string `json:"action"`
	Order  int    `json:"order"`
}

type DocumentVersion struct {
	ID            uuid.UUID `json:"id" db:"id"`
	DocumentID    uuid.UUID `json:"document_id" db:"document_id"`
	VersionNumber int       `json:"version_number" db:"version_number"`
	S3Key         string    `json:"s3_key" db:"s3_key"`
	IPFSCID       *string   `json:"ipfs_cid,omitempty" db:"ipfs_cid"`
	ChangeSummary string    `json:"change_summary" db:"change_summary"`
	UploadedBy    uuid.UUID `json:"uploaded_by" db:"uploaded_by"`
	UploadedAt    time.Time `json:"uploaded_at" db:"uploaded_at"`
}

type DocumentWorkflow struct {
	ID           uuid.UUID       `json:"id" db:"id"`
	Name         string          `json:"name" db:"name"`
	Description  string          `json:"description" db:"description"`
	DocumentType DocumentType    `json:"document_type" db:"document_type"`
	Steps        json.RawMessage `json:"steps" db:"steps"` // Array of {role, action, order}
	CreatedAt    time.Time       `json:"created_at" db:"created_at"`
}

type DocumentSignature struct {
	ID                 uuid.UUID       `json:"id" db:"id"`
	DocumentID         uuid.UUID       `json:"document_id" db:"document_id"`
	SignerName         string          `json:"signer_name" db:"signer_name"`
	SignerRole         string          `json:"signer_role" db:"signer_role"`
	CertificateIssuer  string          `json:"certificate_issuer" db:"certificate_issuer"`
	SigningTime        time.Time       `json:"signing_time" db:"signing_time"`
	IsValid            bool            `json:"is_valid" db:"is_valid"`
	VerificationDetails json.RawMessage `json:"verification_details" db:"verification_details"`
	VerifiedAt         time.Time       `json:"verified_at" db:"verified_at"`
}

type DocumentAccessLog struct {
	ID          uuid.UUID `json:"id" db:"id"`
	DocumentID  uuid.UUID `json:"document_id" db:"document_id"`
	UserID      uuid.UUID `json:"user_id" db:"user_id"`
	Action      string    `json:"action" db:"action"` // 'VIEW', 'DOWNLOAD', 'UPLOAD', 'APPROVE', 'REJECT'
	IPAddress   string    `json:"ip_address" db:"ip_address"`
	UserAgent   string    `json:"user_agent" db:"user_agent"`
	PerformedAt time.Time `json:"performed_at" db:"performed_at"`
}
