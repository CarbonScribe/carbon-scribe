package compliance

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// Repository defines all data access operations for the compliance module.
type Repository interface {
	// Retention Policies
	CreateRetentionPolicy(ctx context.Context, policy *RetentionPolicy) error
	GetRetentionPolicy(ctx context.Context, id string) (*RetentionPolicy, error)
	ListRetentionPolicies(ctx context.Context, dataCategory, jurisdiction string, activeOnly bool) ([]RetentionPolicy, error)
	UpdateRetentionPolicy(ctx context.Context, policy *RetentionPolicy) error
	DeleteRetentionPolicy(ctx context.Context, id string) error

	// Privacy Requests
	CreatePrivacyRequest(ctx context.Context, req *PrivacyRequest) error
	GetPrivacyRequest(ctx context.Context, id string) (*PrivacyRequest, error)
	ListPrivacyRequests(ctx context.Context, userID string, status string, limit, offset int) ([]PrivacyRequest, int64, error)
	UpdatePrivacyRequest(ctx context.Context, req *PrivacyRequest) error
	GetPendingRequests(ctx context.Context, requestType string, limit int) ([]PrivacyRequest, error)

	// Privacy Preferences
	GetPrivacyPreference(ctx context.Context, userID string) (*PrivacyPreference, error)
	UpsertPrivacyPreference(ctx context.Context, pref *PrivacyPreference) error

	// Consent Records
	CreateConsentRecord(ctx context.Context, record *ConsentRecord) error
	GetLatestConsent(ctx context.Context, userID, consentType string) (*ConsentRecord, error)
	ListUserConsents(ctx context.Context, userID string) ([]ConsentRecord, error)
	WithdrawConsent(ctx context.Context, userID, consentType string) error

	// Audit Logs (append-only)
	CreateAuditLog(ctx context.Context, log *AuditLog) error
	QueryAuditLogs(ctx context.Context, query AuditLogQuery) ([]AuditLog, int64, error)
	GetLastAuditLog(ctx context.Context) (*AuditLog, error)

	// Retention Schedules
	CreateRetentionSchedule(ctx context.Context, schedule *RetentionSchedule) error
	GetDueSchedules(ctx context.Context, before time.Time) ([]RetentionSchedule, error)
	UpdateRetentionSchedule(ctx context.Context, schedule *RetentionSchedule) error
	ListRetentionSchedules(ctx context.Context, policyID string) ([]RetentionSchedule, error)

	// Legal Holds
	CreateLegalHold(ctx context.Context, hold *LegalHold) error
	GetLegalHold(ctx context.Context, id string) (*LegalHold, error)
	ListActiveLegalHolds(ctx context.Context) ([]LegalHold, error)
	UpdateLegalHold(ctx context.Context, hold *LegalHold) error
	IsDataUnderLegalHold(ctx context.Context, userID, dataCategory string) (bool, error)

	// Statistics
	GetComplianceStats(ctx context.Context) (*ComplianceStats, error)
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new compliance repository backed by GORM.
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// --- Retention Policies ---

func (r *repository) CreateRetentionPolicy(ctx context.Context, policy *RetentionPolicy) error {
	return r.db.WithContext(ctx).Create(policy).Error
}

func (r *repository) GetRetentionPolicy(ctx context.Context, id string) (*RetentionPolicy, error) {
	var policy RetentionPolicy
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&policy).Error; err != nil {
		return nil, err
	}
	return &policy, nil
}

func (r *repository) ListRetentionPolicies(ctx context.Context, dataCategory, jurisdiction string, activeOnly bool) ([]RetentionPolicy, error) {
	var policies []RetentionPolicy
	q := r.db.WithContext(ctx)
	if dataCategory != "" {
		q = q.Where("data_category = ?", dataCategory)
	}
	if jurisdiction != "" {
		q = q.Where("jurisdiction = ? OR jurisdiction = 'global'", jurisdiction)
	}
	if activeOnly {
		q = q.Where("is_active = true")
	}
	if err := q.Order("created_at DESC").Find(&policies).Error; err != nil {
		return nil, err
	}
	return policies, nil
}

func (r *repository) UpdateRetentionPolicy(ctx context.Context, policy *RetentionPolicy) error {
	return r.db.WithContext(ctx).Save(policy).Error
}

func (r *repository) DeleteRetentionPolicy(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&RetentionPolicy{}).Error
}

// --- Privacy Requests ---

func (r *repository) CreatePrivacyRequest(ctx context.Context, req *PrivacyRequest) error {
	return r.db.WithContext(ctx).Create(req).Error
}

func (r *repository) GetPrivacyRequest(ctx context.Context, id string) (*PrivacyRequest, error) {
	var req PrivacyRequest
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&req).Error; err != nil {
		return nil, err
	}
	return &req, nil
}

func (r *repository) ListPrivacyRequests(ctx context.Context, userID string, status string, limit, offset int) ([]PrivacyRequest, int64, error) {
	var requests []PrivacyRequest
	var total int64

	q := r.db.WithContext(ctx).Model(&PrivacyRequest{})
	if userID != "" {
		q = q.Where("user_id = ?", userID)
	}
	if status != "" {
		q = q.Where("status = ?", status)
	}

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if limit <= 0 {
		limit = 20
	}
	if err := q.Order("submitted_at DESC").Limit(limit).Offset(offset).Find(&requests).Error; err != nil {
		return nil, 0, err
	}
	return requests, total, nil
}

func (r *repository) UpdatePrivacyRequest(ctx context.Context, req *PrivacyRequest) error {
	return r.db.WithContext(ctx).Save(req).Error
}

func (r *repository) GetPendingRequests(ctx context.Context, requestType string, limit int) ([]PrivacyRequest, error) {
	var requests []PrivacyRequest
	q := r.db.WithContext(ctx).Where("status = ?", RequestStatusReceived)
	if requestType != "" {
		q = q.Where("request_type = ?", requestType)
	}
	if limit <= 0 {
		limit = 50
	}
	if err := q.Order("submitted_at ASC").Limit(limit).Find(&requests).Error; err != nil {
		return nil, err
	}
	return requests, nil
}

// --- Privacy Preferences ---

func (r *repository) GetPrivacyPreference(ctx context.Context, userID string) (*PrivacyPreference, error) {
	var pref PrivacyPreference
	if err := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&pref).Error; err != nil {
		return nil, err
	}
	return &pref, nil
}

func (r *repository) UpsertPrivacyPreference(ctx context.Context, pref *PrivacyPreference) error {
	var existing PrivacyPreference
	err := r.db.WithContext(ctx).Where("user_id = ?", pref.UserID).First(&existing).Error
	if err == gorm.ErrRecordNotFound {
		return r.db.WithContext(ctx).Create(pref).Error
	}
	if err != nil {
		return err
	}
	pref.ID = existing.ID
	pref.Version = existing.Version + 1
	pref.PreviousVersionID = &existing.ID
	return r.db.WithContext(ctx).Save(pref).Error
}

// --- Consent Records ---

func (r *repository) CreateConsentRecord(ctx context.Context, record *ConsentRecord) error {
	return r.db.WithContext(ctx).Create(record).Error
}

func (r *repository) GetLatestConsent(ctx context.Context, userID, consentType string) (*ConsentRecord, error) {
	var record ConsentRecord
	if err := r.db.WithContext(ctx).
		Where("user_id = ? AND consent_type = ?", userID, consentType).
		Order("created_at DESC").
		First(&record).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *repository) ListUserConsents(ctx context.Context, userID string) ([]ConsentRecord, error) {
	var records []ConsentRecord
	if err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&records).Error; err != nil {
		return nil, err
	}
	return records, nil
}

func (r *repository) WithdrawConsent(ctx context.Context, userID, consentType string) error {
	now := time.Now()
	return r.db.WithContext(ctx).
		Model(&ConsentRecord{}).
		Where("user_id = ? AND consent_type = ? AND withdrawn_at IS NULL AND consent_given = true", userID, consentType).
		Update("withdrawn_at", now).Error
}

// --- Audit Logs (append-only, no updates/deletes) ---

func (r *repository) CreateAuditLog(ctx context.Context, log *AuditLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *repository) QueryAuditLogs(ctx context.Context, query AuditLogQuery) ([]AuditLog, int64, error) {
	var logs []AuditLog
	var total int64

	q := r.db.WithContext(ctx).Model(&AuditLog{})

	if query.ActorID != "" {
		q = q.Where("actor_id = ?", query.ActorID)
	}
	if query.TargetType != "" {
		q = q.Where("target_type = ?", query.TargetType)
	}
	if query.TargetID != "" {
		q = q.Where("target_id = ?", query.TargetID)
	}
	if query.TargetOwnerID != "" {
		q = q.Where("target_owner_id = ?", query.TargetOwnerID)
	}
	if query.EventType != "" {
		q = q.Where("event_type = ?", query.EventType)
	}
	if query.EventAction != "" {
		q = q.Where("event_action = ?", query.EventAction)
	}
	if query.SensitivityLevel != "" {
		q = q.Where("sensitivity_level = ?", query.SensitivityLevel)
	}
	if query.ServiceName != "" {
		q = q.Where("service_name = ?", query.ServiceName)
	}
	if query.StartTime != nil {
		q = q.Where("event_time >= ?", *query.StartTime)
	}
	if query.EndTime != nil {
		q = q.Where("event_time <= ?", *query.EndTime)
	}

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	limit := query.Limit
	if limit <= 0 {
		limit = 50
	}
	if err := q.Order("event_time DESC").Limit(limit).Offset(query.Offset).Find(&logs).Error; err != nil {
		return nil, 0, err
	}
	return logs, total, nil
}

func (r *repository) GetLastAuditLog(ctx context.Context) (*AuditLog, error) {
	var log AuditLog
	if err := r.db.WithContext(ctx).Order("log_id DESC").First(&log).Error; err != nil {
		return nil, err
	}
	return &log, nil
}

// --- Retention Schedules ---

func (r *repository) CreateRetentionSchedule(ctx context.Context, schedule *RetentionSchedule) error {
	return r.db.WithContext(ctx).Create(schedule).Error
}

func (r *repository) GetDueSchedules(ctx context.Context, before time.Time) ([]RetentionSchedule, error) {
	var schedules []RetentionSchedule
	if err := r.db.WithContext(ctx).
		Preload("Policy").
		Where("next_action_date <= ?", before).
		Order("next_action_date ASC").
		Find(&schedules).Error; err != nil {
		return nil, err
	}
	return schedules, nil
}

func (r *repository) UpdateRetentionSchedule(ctx context.Context, schedule *RetentionSchedule) error {
	return r.db.WithContext(ctx).Save(schedule).Error
}

func (r *repository) ListRetentionSchedules(ctx context.Context, policyID string) ([]RetentionSchedule, error) {
	var schedules []RetentionSchedule
	q := r.db.WithContext(ctx).Preload("Policy")
	if policyID != "" {
		q = q.Where("policy_id = ?", policyID)
	}
	if err := q.Order("next_action_date ASC").Find(&schedules).Error; err != nil {
		return nil, err
	}
	return schedules, nil
}

// --- Legal Holds ---

func (r *repository) CreateLegalHold(ctx context.Context, hold *LegalHold) error {
	return r.db.WithContext(ctx).Create(hold).Error
}

func (r *repository) GetLegalHold(ctx context.Context, id string) (*LegalHold, error) {
	var hold LegalHold
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&hold).Error; err != nil {
		return nil, err
	}
	return &hold, nil
}

func (r *repository) ListActiveLegalHolds(ctx context.Context) ([]LegalHold, error) {
	var holds []LegalHold
	if err := r.db.WithContext(ctx).
		Where("status = ?", LegalHoldActive).
		Order("initiated_at DESC").
		Find(&holds).Error; err != nil {
		return nil, err
	}
	return holds, nil
}

func (r *repository) UpdateLegalHold(ctx context.Context, hold *LegalHold) error {
	return r.db.WithContext(ctx).Save(hold).Error
}

func (r *repository) IsDataUnderLegalHold(ctx context.Context, userID, dataCategory string) (bool, error) {
	var count int64
	q := r.db.WithContext(ctx).Model(&LegalHold{}).Where("status = ?", LegalHoldActive)

	// Check if user is in affected list or data category is held
	// Using raw SQL for array containment since GORM doesn't natively support @>
	if err := q.Where(
		"(? = ANY(affected_user_ids) OR ? = ANY(data_categories))",
		userID, dataCategory,
	).Count(&count).Error; err != nil {
		return false, fmt.Errorf("checking legal hold: %w", err)
	}
	return count > 0, nil
}

// --- Statistics ---

func (r *repository) GetComplianceStats(ctx context.Context) (*ComplianceStats, error) {
	stats := &ComplianceStats{
		ConsentRates: make(map[string]float64),
	}

	r.db.WithContext(ctx).Model(&PrivacyRequest{}).Count(&stats.TotalRequests)
	r.db.WithContext(ctx).Model(&PrivacyRequest{}).Where("status IN ?", []string{RequestStatusReceived, RequestStatusProcessing}).Count(&stats.PendingRequests)
	r.db.WithContext(ctx).Model(&PrivacyRequest{}).Where("status = ?", RequestStatusCompleted).Count(&stats.CompletedRequests)
	r.db.WithContext(ctx).Model(&RetentionPolicy{}).Where("is_active = true").Count(&stats.ActivePolicies)
	r.db.WithContext(ctx).Model(&LegalHold{}).Where("status = ?", LegalHoldActive).Count(&stats.ActiveLegalHolds)
	r.db.WithContext(ctx).Model(&AuditLog{}).Count(&stats.AuditLogCount)

	// Consent rates per type
	consentTypes := []string{ConsentTypeMarketing, ConsentTypeAnalytics, ConsentTypeThirdParty, ConsentTypeResearch}
	for _, ct := range consentTypes {
		var total, given int64
		r.db.WithContext(ctx).Model(&ConsentRecord{}).Where("consent_type = ?", ct).Count(&total)
		r.db.WithContext(ctx).Model(&ConsentRecord{}).Where("consent_type = ? AND consent_given = true AND withdrawn_at IS NULL", ct).Count(&given)
		if total > 0 {
			stats.ConsentRates[ct] = float64(given) / float64(total) * 100
		}
	}

	return stats, nil
}
