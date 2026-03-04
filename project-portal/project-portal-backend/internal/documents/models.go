package documents

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// DocumentType represents the category of a document.
type DocumentType string

const (
	DocumentTypePDD                     DocumentType = "PDD"
	DocumentTypeMonitoringReport        DocumentType = "MONITORING_REPORT"
	DocumentTypeVerificationCertificate DocumentType = "VERIFICATION_CERTIFICATE"
	DocumentTypeCompliance              DocumentType = "COMPLIANCE"
	DocumentTypeOther                   DocumentType = "OTHER"
)

// FileType represents the file format.
type FileType string

const (
	FileTypePDF   FileType = "PDF"
	FileTypeDOCX  FileType = "DOCX"
	FileTypeXLSX  FileType = "XLSX"
	FileTypeImage FileType = "IMAGE"
	FileTypeZIP   FileType = "ZIP"
)

// DocumentStatus represents workflow state.
type DocumentStatus string

const (
	DocumentStatusDraft       DocumentStatus = "draft"
	DocumentStatusSubmitted   DocumentStatus = "submitted"
	DocumentStatusUnderReview DocumentStatus = "under_review"
	DocumentStatusApproved    DocumentStatus = "approved"
	DocumentStatusRejected    DocumentStatus = "rejected"
)

// AccessAction represents what a user did to a document.
type AccessAction string

const (
	ActionView            AccessAction = "VIEW"
	ActionDownload        AccessAction = "DOWNLOAD"
	ActionUpload          AccessAction = "UPLOAD"
	ActionApprove         AccessAction = "APPROVE"
	ActionReject          AccessAction = "REJECT"
	ActionDelete          AccessAction = "DELETE"
	ActionVersionUpload   AccessAction = "VERSION_UPLOAD"
	ActionVerifySignature AccessAction = "VERIFY_SIGNATURE"
)

// DocumentWorkflow defines an approval flow template.
type DocumentWorkflow struct {
	ID           uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name         string         `gorm:"size:255;not null" json:"name"`
	Description  string         `gorm:"type:text" json:"description"`
	DocumentType DocumentType   `gorm:"size:100;not null" json:"document_type"`
	Steps        datatypes.JSON `gorm:"type:jsonb;not null;default:'[]'" json:"steps"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
}

func (DocumentWorkflow) TableName() string { return "document_workflows" }

// Document is the core document record.
type Document struct {
	ID             uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ProjectID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"project_id"`
	Name           string         `gorm:"size:500;not null" json:"name"`
	Description    string         `gorm:"type:text" json:"description"`
	DocumentType   DocumentType   `gorm:"size:100;not null;index" json:"document_type"`
	FileType       FileType       `gorm:"size:50;not null" json:"file_type"`
	FileSize       int64          `gorm:"not null" json:"file_size"`
	S3Key          string         `gorm:"size:1000;not null" json:"s3_key"`
	S3Bucket       string         `gorm:"size:255;not null" json:"s3_bucket"`
	IPFSCID        string         `gorm:"size:100" json:"ipfs_cid,omitempty"`
	CurrentVersion int            `gorm:"default:1" json:"current_version"`
	Status         DocumentStatus `gorm:"size:50;default:'draft';index" json:"status"`
	WorkflowID     *uuid.UUID     `gorm:"type:uuid" json:"workflow_id,omitempty"`
	UploadedBy     *uuid.UUID     `gorm:"type:uuid;index" json:"uploaded_by,omitempty"`
	UploadedAt     time.Time      `gorm:"default:CURRENT_TIMESTAMP" json:"uploaded_at"`
	DeletedAt      *time.Time     `gorm:"index" json:"deleted_at,omitempty"`
	Metadata       datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"metadata"`

	// Associations (loaded on demand)
	Workflow *DocumentWorkflow `gorm:"foreignKey:WorkflowID" json:"workflow,omitempty"`
	Versions []DocumentVersion `gorm:"foreignKey:DocumentID" json:"versions,omitempty"`
}

func (Document) TableName() string { return "documents" }

// DocumentVersion records each uploaded revision of a document.
type DocumentVersion struct {
	ID            uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DocumentID    uuid.UUID  `gorm:"type:uuid;not null;index" json:"document_id"`
	VersionNumber int        `gorm:"not null" json:"version_number"`
	S3Key         string     `gorm:"size:1000;not null" json:"s3_key"`
	S3Bucket      string     `gorm:"size:255;not null" json:"s3_bucket"`
	FileSize      int64      `gorm:"not null;default:0" json:"file_size"`
	IPFSCID       string     `gorm:"size:100" json:"ipfs_cid,omitempty"`
	ChangeSummary string     `gorm:"type:text" json:"change_summary,omitempty"`
	UploadedBy    *uuid.UUID `gorm:"type:uuid" json:"uploaded_by,omitempty"`
	UploadedAt    time.Time  `gorm:"default:CURRENT_TIMESTAMP" json:"uploaded_at"`
}

func (DocumentVersion) TableName() string { return "document_versions" }

// DocumentSignature stores digital signature verification results.
type DocumentSignature struct {
	ID                  uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DocumentID          uuid.UUID      `gorm:"type:uuid;not null;index" json:"document_id"`
	SignerName          string         `gorm:"size:255;not null" json:"signer_name"`
	SignerEmail         string         `gorm:"size:255" json:"signer_email,omitempty"`
	SignerRole          string         `gorm:"size:100" json:"signer_role,omitempty"`
	CertificateIssuer   string         `gorm:"size:255" json:"certificate_issuer,omitempty"`
	CertificateSubject  string         `gorm:"size:255" json:"certificate_subject,omitempty"`
	SigningTime         time.Time      `gorm:"not null" json:"signing_time"`
	IsValid             bool           `gorm:"not null;default:false" json:"is_valid"`
	VerificationDetails datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"verification_details"`
	VerifiedAt          time.Time      `gorm:"default:CURRENT_TIMESTAMP" json:"verified_at"`
}

func (DocumentSignature) TableName() string { return "document_signatures" }

// DocumentAccessLog records every action performed on a document.
type DocumentAccessLog struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DocumentID  uuid.UUID      `gorm:"type:uuid;not null;index" json:"document_id"`
	UserID      *uuid.UUID     `gorm:"type:uuid;index" json:"user_id,omitempty"`
	Action      AccessAction   `gorm:"size:50;not null" json:"action"`
	IPAddress   string         `gorm:"type:inet" json:"ip_address,omitempty"`
	UserAgent   string         `gorm:"type:text" json:"user_agent,omitempty"`
	Details     datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"details"`
	PerformedAt time.Time      `gorm:"default:CURRENT_TIMESTAMP;index" json:"performed_at"`
}

func (DocumentAccessLog) TableName() string { return "document_access_logs" }

// UploadRequest is the incoming multipart form data structure.
type UploadRequest struct {
	ProjectID    string `form:"project_id" binding:"required"`
	Name         string `form:"name" binding:"required"`
	Description  string `form:"description"`
	DocumentType string `form:"document_type" binding:"required"`
}

// ListFilter contains query parameters for listing documents.
type ListFilter struct {
	ProjectID    string `form:"project_id"`
	DocumentType string `form:"document_type"`
	Status       string `form:"status"`
	UploadedBy   string `form:"uploaded_by"`
	Page         int    `form:"page,default=1"`
	PageSize     int    `form:"page_size,default=20"`
}

// ListResponse wraps paginated document results.
type ListResponse struct {
	Data       []Document `json:"data"`
	Total      int64      `json:"total"`
	Page       int        `json:"page"`
	PageSize   int        `json:"page_size"`
	TotalPages int        `json:"total_pages"`
}
