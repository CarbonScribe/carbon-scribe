package compliance

import (
	"net"
	"time"

	"github.com/lib/pq"
)

// Data category constants
const (
	DataCategoryUserProfile    = "user_profile"
	DataCategoryProjectData    = "project_data"
	DataCategoryFinancialRecs  = "financial_records"
	DataCategorySystemLogs     = "system_logs"
)

// Deletion method constants
const (
	DeletionMethodSoftDelete    = "soft_delete"
	DeletionMethodHardDelete    = "hard_delete"
	DeletionMethodAnonymize     = "anonymize"
	DeletionMethodPseudonymize  = "pseudonymize"
)

// Privacy request types
const (
	RequestTypeExport      = "export"
	RequestTypeDeletion    = "deletion"
	RequestTypeCorrection  = "correction"
	RequestTypeRestriction = "restriction"
)

// Privacy request status
const (
	RequestStatusReceived   = "received"
	RequestStatusProcessing = "processing"
	RequestStatusCompleted  = "completed"
	RequestStatusFailed     = "failed"
	RequestStatusCancelled  = "cancelled"
)

// Sensitivity levels
const (
	SensitivityNormal        = "normal"
	SensitivitySensitive     = "sensitive"
	SensitivityHighly        = "highly_sensitive"
)

// Consent types
const (
	ConsentTypeMarketing      = "marketing"
	ConsentTypePrivacyPolicy  = "privacy_policy"
	ConsentTypeTermsOfService = "terms_of_service"
	ConsentTypeCookies        = "cookies"
	ConsentTypeAnalytics      = "analytics"
	ConsentTypeThirdParty     = "third_party"
	ConsentTypeResearch       = "research"
)

// Actor types for audit
const (
	ActorTypeUser      = "user"
	ActorTypeSystem    = "system"
	ActorTypeAPIClient = "api_client"
)

// Legal hold status
const (
	LegalHoldActive   = "active"
	LegalHoldReleased = "released"
	LegalHoldExpired  = "expired"
)

// RetentionPolicy defines how long data should be retained per category.
type RetentionPolicy struct {
	ID                 string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	Name               string         `gorm:"not null" json:"name"`
	Description        string         `gorm:"type:text" json:"description"`
	DataCategory       string         `gorm:"not null;index" json:"data_category"`
	Jurisdiction       string         `gorm:"default:'global';index" json:"jurisdiction"`
	RetentionPeriodDays int           `gorm:"not null" json:"retention_period_days"`
	ArchivalPeriodDays  *int          `json:"archival_period_days,omitempty"`
	ReviewPeriodDays    int           `gorm:"default:365" json:"review_period_days"`
	DeletionMethod     string         `gorm:"default:'soft_delete'" json:"deletion_method"`
	AnonymizationRules map[string]any `gorm:"serializer:json" json:"anonymization_rules,omitempty"`
	LegalHoldEnabled   bool           `gorm:"default:true" json:"legal_hold_enabled"`
	IsActive           bool           `gorm:"default:true" json:"is_active"`
	Version            int            `gorm:"default:1" json:"version"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
}

// PrivacyRequest represents a GDPR data subject request.
type PrivacyRequest struct {
	ID                  string     `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	UserID              string     `gorm:"not null;index" json:"user_id"`
	RequestType         string     `gorm:"not null" json:"request_type"`
	RequestSubtype      string     `json:"request_subtype,omitempty"`
	Status              string     `gorm:"default:'received'" json:"status"`
	SubmittedAt         time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"submitted_at"`
	CompletedAt         *time.Time `json:"completed_at,omitempty"`
	EstimatedCompletion *time.Time `json:"estimated_completion,omitempty"`
	DataCategories      pq.StringArray `gorm:"type:text[]" json:"data_categories,omitempty"`
	DateRangeStart      *time.Time `json:"date_range_start,omitempty"`
	DateRangeEnd        *time.Time `json:"date_range_end,omitempty"`
	VerificationMethod  string     `json:"verification_method,omitempty"`
	VerifiedBy          *string    `json:"verified_by,omitempty"`
	VerifiedAt          *time.Time `json:"verified_at,omitempty"`
	ExportFileURL       string     `json:"export_file_url,omitempty"`
	ExportFileHash      string     `json:"export_file_hash,omitempty"`
	DeletionSummary     map[string]any `gorm:"serializer:json" json:"deletion_summary,omitempty"`
	ErrorMessage        string     `json:"error_message,omitempty"`
	LegalBasis          string     `json:"legal_basis,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

// PrivacyPreference stores a user's privacy settings with version tracking.
type PrivacyPreference struct {
	ID                     string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	UserID                 string    `gorm:"not null;uniqueIndex" json:"user_id"`
	MarketingEmails        bool      `gorm:"default:false" json:"marketing_emails"`
	PromotionalEmails      bool      `gorm:"default:false" json:"promotional_emails"`
	SystemNotifications    bool      `gorm:"default:true" json:"system_notifications"`
	ThirdPartySharing      bool      `gorm:"default:false" json:"third_party_sharing"`
	AnalyticsTracking      bool      `gorm:"default:true" json:"analytics_tracking"`
	DataRetentionConsent   bool      `gorm:"default:true" json:"data_retention_consent"`
	ResearchParticipation  bool      `gorm:"default:false" json:"research_participation"`
	AutomatedDecisionMaking bool     `gorm:"default:false" json:"automated_decision_making"`
	Jurisdiction           string    `gorm:"default:'GDPR'" json:"jurisdiction"`
	Version                int       `gorm:"default:1" json:"version"`
	PreviousVersionID      *string   `json:"previous_version_id,omitempty"`
	CreatedAt              time.Time `json:"created_at"`
	UpdatedAt              time.Time `json:"updated_at"`
}

// ConsentRecord captures a single consent action with evidence.
type ConsentRecord struct {
	ID             string     `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	UserID         string     `gorm:"not null;index" json:"user_id"`
	ConsentType    string     `gorm:"not null" json:"consent_type"`
	ConsentVersion string     `gorm:"not null" json:"consent_version"`
	ConsentGiven   bool       `gorm:"not null" json:"consent_given"`
	Context        string     `gorm:"type:text" json:"context,omitempty"`
	Purpose        string     `gorm:"type:text" json:"purpose,omitempty"`
	IPAddress      string     `json:"ip_address,omitempty"`
	UserAgent      string     `json:"user_agent,omitempty"`
	Geolocation    string     `json:"geolocation,omitempty"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty"`
	WithdrawnAt    *time.Time `json:"withdrawn_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

// AuditLog is an immutable record of data access or modification.
type AuditLog struct {
	LogID           int64          `gorm:"primaryKey;autoIncrement" json:"log_id"`
	EventTime       time.Time      `gorm:"not null;index;default:CURRENT_TIMESTAMP" json:"event_time"`
	EventType       string         `gorm:"not null" json:"event_type"`
	EventAction     string         `gorm:"not null" json:"event_action"`
	ActorID         *string        `json:"actor_id,omitempty"`
	ActorType       string         `json:"actor_type,omitempty"`
	ActorIP         string         `json:"actor_ip,omitempty"`
	TargetType      string         `json:"target_type,omitempty"`
	TargetID        *string        `json:"target_id,omitempty"`
	TargetOwnerID   *string        `json:"target_owner_id,omitempty"`
	DataCategory    string         `json:"data_category,omitempty"`
	SensitivityLevel string       `gorm:"default:'normal'" json:"sensitivity_level"`
	ServiceName     string         `gorm:"not null" json:"service_name"`
	Endpoint        string         `json:"endpoint,omitempty"`
	HTTPMethod      string         `json:"http_method,omitempty"`
	OldValues       map[string]any `gorm:"serializer:json" json:"old_values,omitempty"`
	NewValues       map[string]any `gorm:"serializer:json" json:"new_values,omitempty"`
	PermissionUsed  string         `json:"permission_used,omitempty"`
	Signature       string         `json:"signature,omitempty"`
	HashChain       string         `json:"hash_chain,omitempty"`
	CreatedAt       time.Time      `json:"created_at"`
}

// RetentionSchedule tracks when retention actions should occur.
type RetentionSchedule struct {
	ID                  string     `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	PolicyID            string     `gorm:"not null;index" json:"policy_id"`
	Policy              RetentionPolicy `gorm:"foreignKey:PolicyID" json:"policy,omitempty"`
	DataType            string     `gorm:"not null" json:"data_type"`
	NextReviewDate      time.Time  `gorm:"type:date;not null" json:"next_review_date"`
	NextActionDate      *time.Time `gorm:"type:date" json:"next_action_date,omitempty"`
	ActionType          string     `json:"action_type,omitempty"`
	LastActionDate      *time.Time `gorm:"type:date" json:"last_action_date,omitempty"`
	LastActionType      string     `json:"last_action_type,omitempty"`
	LastActionResult    string     `json:"last_action_result,omitempty"`
	RecordCountEstimate *int64     `json:"record_count_estimate,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

// LegalHold suspends data deletion for items under investigation.
type LegalHold struct {
	ID              string      `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	Name            string      `gorm:"not null" json:"name"`
	Description     string      `gorm:"type:text" json:"description,omitempty"`
	Reason          string      `gorm:"type:text;not null" json:"reason"`
	Status          string      `gorm:"default:'active';index" json:"status"`
	DataCategories  pq.StringArray `gorm:"type:text[]" json:"data_categories,omitempty"`
	AffectedUserIDs pq.StringArray `gorm:"type:text[]" json:"affected_user_ids,omitempty"`
	InitiatedBy     string      `gorm:"not null" json:"initiated_by"`
	ReleasedBy      *string     `json:"released_by,omitempty"`
	InitiatedAt     time.Time   `gorm:"default:CURRENT_TIMESTAMP" json:"initiated_at"`
	ReleasedAt      *time.Time  `json:"released_at,omitempty"`
	ExpiresAt       *time.Time  `json:"expires_at,omitempty"`
	CreatedAt       time.Time   `json:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"`
}

// --- Request / Response DTOs ---

type CreateRetentionPolicyRequest struct {
	Name                string         `json:"name" binding:"required"`
	Description         string         `json:"description"`
	DataCategory        string         `json:"data_category" binding:"required"`
	Jurisdiction        string         `json:"jurisdiction"`
	RetentionPeriodDays int            `json:"retention_period_days" binding:"required"`
	ArchivalPeriodDays  *int           `json:"archival_period_days"`
	ReviewPeriodDays    int            `json:"review_period_days"`
	DeletionMethod      string         `json:"deletion_method"`
	AnonymizationRules  map[string]any `json:"anonymization_rules"`
	LegalHoldEnabled    bool           `json:"legal_hold_enabled"`
}

type ExportRequest struct {
	DataCategories []string   `json:"data_categories"`
	DateRangeStart *time.Time `json:"date_range_start"`
	DateRangeEnd   *time.Time `json:"date_range_end"`
	Format         string     `json:"format"`
}

type DeleteRequest struct {
	DataCategories []string `json:"data_categories"`
	LegalBasis     string   `json:"legal_basis"`
}

type UpdatePreferencesRequest struct {
	MarketingEmails         *bool   `json:"marketing_emails"`
	PromotionalEmails       *bool   `json:"promotional_emails"`
	SystemNotifications     *bool   `json:"system_notifications"`
	ThirdPartySharing       *bool   `json:"third_party_sharing"`
	AnalyticsTracking       *bool   `json:"analytics_tracking"`
	DataRetentionConsent    *bool   `json:"data_retention_consent"`
	ResearchParticipation   *bool   `json:"research_participation"`
	AutomatedDecisionMaking *bool   `json:"automated_decision_making"`
	Jurisdiction            string  `json:"jurisdiction"`
}

type RecordConsentRequest struct {
	ConsentType    string `json:"consent_type" binding:"required"`
	ConsentVersion string `json:"consent_version" binding:"required"`
	ConsentGiven   bool   `json:"consent_given"`
	Context        string `json:"context"`
	Purpose        string `json:"purpose"`
}

type AuditLogQuery struct {
	ActorID         string     `form:"actor_id"`
	TargetType      string     `form:"target_type"`
	TargetID        string     `form:"target_id"`
	TargetOwnerID   string     `form:"target_owner_id"`
	EventType       string     `form:"event_type"`
	EventAction     string     `form:"event_action"`
	SensitivityLevel string   `form:"sensitivity_level"`
	ServiceName     string     `form:"service_name"`
	StartTime       *time.Time `form:"start_time" time_format:"2006-01-02T15:04:05Z07:00"`
	EndTime         *time.Time `form:"end_time" time_format:"2006-01-02T15:04:05Z07:00"`
	Limit           int        `form:"limit"`
	Offset          int        `form:"offset"`
}

type CreateLegalHoldRequest struct {
	Name            string   `json:"name" binding:"required"`
	Description     string   `json:"description"`
	Reason          string   `json:"reason" binding:"required"`
	DataCategories  []string `json:"data_categories"`
	AffectedUserIDs []string `json:"affected_user_ids"`
	ExpiresAt       *time.Time `json:"expires_at"`
}

// AuditEntry is used by the audit middleware to construct an audit log entry.
type AuditEntry struct {
	EventType        string
	EventAction      string
	ActorID          string
	ActorType        string
	ActorIP          net.IP
	TargetType       string
	TargetID         string
	TargetOwnerID    string
	DataCategory     string
	SensitivityLevel string
	ServiceName      string
	Endpoint         string
	HTTPMethod       string
	OldValues        map[string]any
	NewValues        map[string]any
	PermissionUsed   string
}

type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Total      int64       `json:"total"`
	Limit      int         `json:"limit"`
	Offset     int         `json:"offset"`
}

type ComplianceStats struct {
	TotalRequests       int64            `json:"total_requests"`
	PendingRequests     int64            `json:"pending_requests"`
	CompletedRequests   int64            `json:"completed_requests"`
	ActivePolicies      int64            `json:"active_policies"`
	ActiveLegalHolds    int64            `json:"active_legal_holds"`
	ConsentRates        map[string]float64 `json:"consent_rates"`
	AuditLogCount       int64            `json:"audit_log_count"`
}
