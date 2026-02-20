package compliance

import (
	"context"
	"fmt"
	"time"

	auditpkg "carbon-scribe/project-portal/project-portal-backend/internal/compliance/audit"
)

// Service orchestrates all compliance operations.
type Service struct {
	repo        Repository
	auditLogger *auditpkg.Logger
}

// NewService creates a new compliance service with all sub-components.
func NewService(repo Repository) *Service {
	return &Service{
		repo:        repo,
		auditLogger: auditpkg.NewLogger(),
	}
}

// --- Retention Policy Operations ---

func (s *Service) CreateRetentionPolicy(ctx context.Context, req CreateRetentionPolicyRequest) (*RetentionPolicy, error) {
	policy := &RetentionPolicy{
		Name:                req.Name,
		Description:         req.Description,
		DataCategory:        req.DataCategory,
		Jurisdiction:        req.Jurisdiction,
		RetentionPeriodDays: req.RetentionPeriodDays,
		ArchivalPeriodDays:  req.ArchivalPeriodDays,
		ReviewPeriodDays:    req.ReviewPeriodDays,
		DeletionMethod:      req.DeletionMethod,
		AnonymizationRules:  req.AnonymizationRules,
		LegalHoldEnabled:    req.LegalHoldEnabled,
		IsActive:            true,
		Version:             1,
	}

	if policy.Jurisdiction == "" {
		policy.Jurisdiction = "global"
	}
	if policy.DeletionMethod == "" {
		policy.DeletionMethod = DeletionMethodSoftDelete
	}
	if policy.ReviewPeriodDays == 0 {
		policy.ReviewPeriodDays = 365
	}

	if err := s.repo.CreateRetentionPolicy(ctx, policy); err != nil {
		return nil, fmt.Errorf("creating retention policy: %w", err)
	}
	return policy, nil
}

func (s *Service) GetRetentionPolicy(ctx context.Context, id string) (*RetentionPolicy, error) {
	return s.repo.GetRetentionPolicy(ctx, id)
}

func (s *Service) ListRetentionPolicies(ctx context.Context, dataCategory, jurisdiction string, activeOnly bool) ([]RetentionPolicy, error) {
	return s.repo.ListRetentionPolicies(ctx, dataCategory, jurisdiction, activeOnly)
}

func (s *Service) UpdateRetentionPolicy(ctx context.Context, id string, req CreateRetentionPolicyRequest) (*RetentionPolicy, error) {
	policy, err := s.repo.GetRetentionPolicy(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("fetching policy: %w", err)
	}

	policy.Name = req.Name
	policy.Description = req.Description
	policy.DataCategory = req.DataCategory
	if req.Jurisdiction != "" {
		policy.Jurisdiction = req.Jurisdiction
	}
	policy.RetentionPeriodDays = req.RetentionPeriodDays
	policy.ArchivalPeriodDays = req.ArchivalPeriodDays
	policy.ReviewPeriodDays = req.ReviewPeriodDays
	if req.DeletionMethod != "" {
		policy.DeletionMethod = req.DeletionMethod
	}
	policy.AnonymizationRules = req.AnonymizationRules
	policy.LegalHoldEnabled = req.LegalHoldEnabled
	policy.Version++

	if err := s.repo.UpdateRetentionPolicy(ctx, policy); err != nil {
		return nil, fmt.Errorf("updating retention policy: %w", err)
	}
	return policy, nil
}

// --- Privacy Request Operations ---

func (s *Service) CreateExportRequest(ctx context.Context, userID string, req ExportRequest) (*PrivacyRequest, error) {
	estimated := time.Now().Add(72 * time.Hour)
	privReq := &PrivacyRequest{
		UserID:              userID,
		RequestType:         RequestTypeExport,
		RequestSubtype:      "full_export",
		Status:              RequestStatusReceived,
		SubmittedAt:         time.Now(),
		EstimatedCompletion: &estimated,
		DataCategories:      req.DataCategories,
		DateRangeStart:      req.DateRangeStart,
		DateRangeEnd:        req.DateRangeEnd,
		LegalBasis:          "consent",
	}

	if len(req.DataCategories) > 0 {
		privReq.RequestSubtype = "partial_export"
	}

	if err := s.repo.CreatePrivacyRequest(ctx, privReq); err != nil {
		return nil, fmt.Errorf("creating export request: %w", err)
	}
	return privReq, nil
}

func (s *Service) CreateDeleteRequest(ctx context.Context, userID string, req DeleteRequest) (*PrivacyRequest, error) {
	for _, cat := range req.DataCategories {
		held, err := s.repo.IsDataUnderLegalHold(ctx, userID, cat)
		if err != nil {
			return nil, fmt.Errorf("checking legal hold: %w", err)
		}
		if held {
			return nil, fmt.Errorf("data category %q is under legal hold and cannot be deleted", cat)
		}
	}

	estimated := time.Now().Add(72 * time.Hour)
	privReq := &PrivacyRequest{
		UserID:              userID,
		RequestType:         RequestTypeDeletion,
		RequestSubtype:      "complete_deletion",
		Status:              RequestStatusReceived,
		SubmittedAt:         time.Now(),
		EstimatedCompletion: &estimated,
		DataCategories:      req.DataCategories,
		LegalBasis:          req.LegalBasis,
	}

	if len(req.DataCategories) > 0 {
		privReq.RequestSubtype = "partial_deletion"
	}

	if err := s.repo.CreatePrivacyRequest(ctx, privReq); err != nil {
		return nil, fmt.Errorf("creating deletion request: %w", err)
	}
	return privReq, nil
}

func (s *Service) GetRequestStatus(ctx context.Context, id string) (*PrivacyRequest, error) {
	return s.repo.GetPrivacyRequest(ctx, id)
}

func (s *Service) ListRequests(ctx context.Context, userID, status string, limit, offset int) ([]PrivacyRequest, int64, error) {
	return s.repo.ListPrivacyRequests(ctx, userID, status, limit, offset)
}

// --- Privacy Preferences ---

func (s *Service) GetPreferences(ctx context.Context, userID string) (*PrivacyPreference, error) {
	pref, err := s.repo.GetPrivacyPreference(ctx, userID)
	if err != nil {
		return &PrivacyPreference{
			UserID:               userID,
			SystemNotifications:  true,
			AnalyticsTracking:    true,
			DataRetentionConsent: true,
			Jurisdiction:         "GDPR",
			Version:              0,
		}, nil
	}
	return pref, nil
}

func (s *Service) UpdatePreferences(ctx context.Context, userID string, req UpdatePreferencesRequest) (*PrivacyPreference, error) {
	pref, _ := s.repo.GetPrivacyPreference(ctx, userID)
	if pref == nil {
		pref = &PrivacyPreference{
			UserID:               userID,
			SystemNotifications:  true,
			AnalyticsTracking:    true,
			DataRetentionConsent: true,
			Jurisdiction:         "GDPR",
		}
	}

	if req.MarketingEmails != nil {
		pref.MarketingEmails = *req.MarketingEmails
	}
	if req.PromotionalEmails != nil {
		pref.PromotionalEmails = *req.PromotionalEmails
	}
	if req.SystemNotifications != nil {
		pref.SystemNotifications = *req.SystemNotifications
	}
	if req.ThirdPartySharing != nil {
		pref.ThirdPartySharing = *req.ThirdPartySharing
	}
	if req.AnalyticsTracking != nil {
		pref.AnalyticsTracking = *req.AnalyticsTracking
	}
	if req.DataRetentionConsent != nil {
		pref.DataRetentionConsent = *req.DataRetentionConsent
	}
	if req.ResearchParticipation != nil {
		pref.ResearchParticipation = *req.ResearchParticipation
	}
	if req.AutomatedDecisionMaking != nil {
		pref.AutomatedDecisionMaking = *req.AutomatedDecisionMaking
	}
	if req.Jurisdiction != "" {
		pref.Jurisdiction = req.Jurisdiction
	}

	if err := s.repo.UpsertPrivacyPreference(ctx, pref); err != nil {
		return nil, fmt.Errorf("updating preferences: %w", err)
	}
	return pref, nil
}

// --- Consent Tracking ---

func (s *Service) RecordConsent(ctx context.Context, userID string, req RecordConsentRequest, ipAddress, userAgent string) (*ConsentRecord, error) {
	record := &ConsentRecord{
		UserID:         userID,
		ConsentType:    req.ConsentType,
		ConsentVersion: req.ConsentVersion,
		ConsentGiven:   req.ConsentGiven,
		Context:        req.Context,
		Purpose:        req.Purpose,
		IPAddress:      ipAddress,
		UserAgent:      userAgent,
		CreatedAt:      time.Now(),
	}

	if err := s.repo.CreateConsentRecord(ctx, record); err != nil {
		return nil, fmt.Errorf("recording consent: %w", err)
	}
	return record, nil
}

func (s *Service) WithdrawConsent(ctx context.Context, userID, consentType string) error {
	if err := s.repo.WithdrawConsent(ctx, userID, consentType); err != nil {
		return fmt.Errorf("withdrawing consent: %w", err)
	}

	record := &ConsentRecord{
		UserID:         userID,
		ConsentType:    consentType,
		ConsentVersion: "withdrawal",
		ConsentGiven:   false,
		Context:        "user_initiated_withdrawal",
		CreatedAt:      time.Now(),
	}
	return s.repo.CreateConsentRecord(ctx, record)
}

func (s *Service) ListUserConsents(ctx context.Context, userID string) ([]ConsentRecord, error) {
	return s.repo.ListUserConsents(ctx, userID)
}

// --- Audit Logs ---

func (s *Service) QueryAuditLogs(ctx context.Context, query AuditLogQuery) ([]AuditLog, int64, error) {
	return s.repo.QueryAuditLogs(ctx, query)
}

func (s *Service) LogAuditEvent(ctx context.Context, entry AuditEntry) error {
	prevHash := ""
	lastLog, err := s.repo.GetLastAuditLog(ctx)
	if err == nil && lastLog != nil {
		prevHash = lastLog.HashChain
	}

	auditEntry := auditpkg.AuditLogEntry{
		EventTime:        time.Now(),
		EventType:        entry.EventType,
		EventAction:      entry.EventAction,
		ActorID:          entry.ActorID,
		ActorType:        entry.ActorType,
		TargetType:       entry.TargetType,
		TargetID:         entry.TargetID,
		TargetOwnerID:    entry.TargetOwnerID,
		DataCategory:     entry.DataCategory,
		SensitivityLevel: entry.SensitivityLevel,
		ServiceName:      entry.ServiceName,
		Endpoint:         entry.Endpoint,
		HTTPMethod:       entry.HTTPMethod,
		OldValues:        entry.OldValues,
		NewValues:        entry.NewValues,
		PermissionUsed:   entry.PermissionUsed,
	}
	if entry.ActorIP != nil {
		auditEntry.ActorIP = entry.ActorIP.String()
	}

	built := s.auditLogger.BuildEntry(auditEntry, prevHash)

	log := &AuditLog{
		EventTime:        built.EventTime,
		EventType:        built.EventType,
		EventAction:      built.EventAction,
		ActorType:        built.ActorType,
		ActorIP:          built.ActorIP,
		TargetType:       built.TargetType,
		DataCategory:     built.DataCategory,
		SensitivityLevel: built.SensitivityLevel,
		ServiceName:      built.ServiceName,
		Endpoint:         built.Endpoint,
		HTTPMethod:       built.HTTPMethod,
		OldValues:        built.OldValues,
		NewValues:        built.NewValues,
		PermissionUsed:   built.PermissionUsed,
		HashChain:        built.HashChain,
		Signature:        built.Signature,
	}

	if built.ActorID != "" {
		log.ActorID = &built.ActorID
	}
	if built.TargetID != "" {
		log.TargetID = &built.TargetID
	}
	if built.TargetOwnerID != "" {
		log.TargetOwnerID = &built.TargetOwnerID
	}

	return s.repo.CreateAuditLog(ctx, log)
}

// --- Retention Schedules ---

func (s *Service) ListRetentionSchedules(ctx context.Context, policyID string) ([]RetentionSchedule, error) {
	return s.repo.ListRetentionSchedules(ctx, policyID)
}

// --- Legal Holds ---

func (s *Service) CreateLegalHold(ctx context.Context, req CreateLegalHoldRequest, initiatedBy string) (*LegalHold, error) {
	hold := &LegalHold{
		Name:            req.Name,
		Description:     req.Description,
		Reason:          req.Reason,
		Status:          LegalHoldActive,
		DataCategories:  req.DataCategories,
		AffectedUserIDs: req.AffectedUserIDs,
		InitiatedBy:     initiatedBy,
		InitiatedAt:     time.Now(),
		ExpiresAt:       req.ExpiresAt,
	}

	if err := s.repo.CreateLegalHold(ctx, hold); err != nil {
		return nil, fmt.Errorf("creating legal hold: %w", err)
	}
	return hold, nil
}

func (s *Service) ReleaseLegalHold(ctx context.Context, id, releasedBy string) (*LegalHold, error) {
	hold, err := s.repo.GetLegalHold(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("fetching legal hold: %w", err)
	}

	now := time.Now()
	hold.Status = LegalHoldReleased
	hold.ReleasedBy = &releasedBy
	hold.ReleasedAt = &now

	if err := s.repo.UpdateLegalHold(ctx, hold); err != nil {
		return nil, fmt.Errorf("releasing legal hold: %w", err)
	}
	return hold, nil
}

func (s *Service) ListActiveLegalHolds(ctx context.Context) ([]LegalHold, error) {
	return s.repo.ListActiveLegalHolds(ctx)
}

// --- Statistics ---

func (s *Service) GetStats(ctx context.Context) (*ComplianceStats, error) {
	return s.repo.GetComplianceStats(ctx)
}
