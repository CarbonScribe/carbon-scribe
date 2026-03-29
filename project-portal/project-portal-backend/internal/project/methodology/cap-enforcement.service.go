package methodology

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CapConfigEnvelope struct {
	MethodologyTokenID int
	MaxSupply          int64
	CapPerProject      *int64
	CapPerVintage      *int64
	RawConfiguration   map[string]any
	SourceType         string
	SourceReference    string
}

type CapConfigClient interface {
	GetSupplyCapConfiguration(ctx context.Context, methodologyTokenID int) (*CapConfigEnvelope, error)
}

type CapEnforcementService interface {
	EnsureCapConfigured(ctx context.Context, methodologyTokenID int) (*MethodologyCap, error)
	SetMethodologyCap(ctx context.Context, methodologyTokenID int, req MethodologyCapRequest) (*MethodologyCap, error)
	GetMethodologyCap(ctx context.Context, methodologyTokenID int) (*MethodologyCap, error)
	GetMethodologySupply(ctx context.Context, methodologyTokenID int) (*MethodologySupplyResponse, error)
	ValidateAndExecuteMint(ctx context.Context, input MintValidationInput, executeMint func(context.Context) error) (*MintingAttempt, error)
	GetMintingHistory(ctx context.Context, methodologyTokenID int, limit int) ([]MintingAttempt, error)
	GetProjectValidationHistory(ctx context.Context, projectID uuid.UUID, limit int) ([]MintingAttempt, error)
	ListNearLimitCaps(ctx context.Context, thresholdRatio float64) ([]MethodologySupplyResponse, error)
}

type capEnforcementService struct {
	repo            CapRepository
	baseRepo        Repository
	configClient    CapConfigClient
	nearLimitRatio  float64
	nearLimitBuffer float64
}

func NewCapEnforcementService(repo CapRepository, baseRepo Repository, configClient CapConfigClient) CapEnforcementService {
	return &capEnforcementService{
		repo:            repo,
		baseRepo:        baseRepo,
		configClient:    configClient,
		nearLimitRatio:  0.9,
		nearLimitBuffer: 0.95,
	}
}

func (s *capEnforcementService) EnsureCapConfigured(ctx context.Context, methodologyTokenID int) (*MethodologyCap, error) {
	cap, err := s.repo.GetMethodologyCap(ctx, methodologyTokenID)
	if err == nil {
		return cap, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if s.configClient == nil {
		return nil, fmt.Errorf("%w: token %d", ErrCapNotConfigured, methodologyTokenID)
	}

	cfg, err := s.configClient.GetSupplyCapConfiguration(ctx, methodologyTokenID)
	if err != nil {
		return nil, err
	}
	if cfg == nil || cfg.MaxSupply <= 0 {
		return nil, fmt.Errorf("invalid cap configuration from source for methodology token %d", methodologyTokenID)
	}
	if strings.TrimSpace(cfg.SourceType) == "" {
		cfg.SourceType = CapSourceContract
	}

	newCap := &MethodologyCap{
		MethodologyTokenID: methodologyTokenID,
		MaxSupply:          cfg.MaxSupply,
		CurrentSupply:      0,
		CapPerProject:      cfg.CapPerProject,
		CapPerVintage:      cfg.CapPerVintage,
		EffectiveFrom:      time.Now().UTC(),
		CreatedBy:          "system:contract-sync",
	}
	if err := s.repo.UpsertMethodologyCap(ctx, newCap); err != nil {
		return nil, err
	}
	if err := s.recordCapSource(ctx, methodologyTokenID, cfg.SourceType, cfg.SourceReference, cfg.RawConfiguration); err != nil {
		return nil, err
	}
	return s.repo.GetMethodologyCap(ctx, methodologyTokenID)
}

func (s *capEnforcementService) SetMethodologyCap(ctx context.Context, methodologyTokenID int, req MethodologyCapRequest) (*MethodologyCap, error) {
	if methodologyTokenID <= 0 {
		return nil, fmt.Errorf("invalid methodology token id")
	}
	if req.MaxSupply <= 0 {
		return nil, fmt.Errorf("max_supply must be positive")
	}

	// Ensure the methodology token exists for audit consistency.
	if s.baseRepo != nil {
		if _, err := s.baseRepo.GetRegistrationByTokenID(ctx, methodologyTokenID); err != nil {
			return nil, fmt.Errorf("unknown methodology token id %d", methodologyTokenID)
		}
	}

	effectiveFrom := time.Now().UTC()
	if strings.TrimSpace(req.EffectiveFrom) != "" {
		parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(req.EffectiveFrom))
		if err != nil {
			return nil, fmt.Errorf("invalid effective_from, expected RFC3339")
		}
		effectiveFrom = parsed.UTC()
	}

	var effectiveTo *time.Time
	if strings.TrimSpace(req.EffectiveTo) != "" {
		parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(req.EffectiveTo))
		if err != nil {
			return nil, fmt.Errorf("invalid effective_to, expected RFC3339")
		}
		parsedUTC := parsed.UTC()
		effectiveTo = &parsedUTC
	}

	cap := &MethodologyCap{
		MethodologyTokenID: methodologyTokenID,
		MaxSupply:          req.MaxSupply,
		CapPerProject:      req.CapPerProject,
		CapPerVintage:      req.CapPerVintage,
		EffectiveFrom:      effectiveFrom,
		EffectiveTo:        effectiveTo,
		CreatedBy:          strings.TrimSpace(req.CreatedBy),
	}

	if err := s.repo.UpsertMethodologyCap(ctx, cap); err != nil {
		return nil, err
	}
	raw := map[string]any{
		"max_supply":      req.MaxSupply,
		"cap_per_project": req.CapPerProject,
		"cap_per_vintage": req.CapPerVintage,
		"effective_from":  effectiveFrom,
		"effective_to":    effectiveTo,
	}
	sourceType := strings.ToUpper(strings.TrimSpace(req.SourceType))
	if sourceType == "" {
		sourceType = CapSourceAdmin
	}
	if err := s.recordCapSource(ctx, methodologyTokenID, sourceType, req.SourceRef, raw); err != nil {
		return nil, err
	}
	return s.repo.GetMethodologyCap(ctx, methodologyTokenID)
}

func (s *capEnforcementService) GetMethodologyCap(ctx context.Context, methodologyTokenID int) (*MethodologyCap, error) {
	cap, err := s.repo.GetMethodologyCap(ctx, methodologyTokenID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return s.EnsureCapConfigured(ctx, methodologyTokenID)
	}
	return cap, err
}

func (s *capEnforcementService) GetMethodologySupply(ctx context.Context, methodologyTokenID int) (*MethodologySupplyResponse, error) {
	cap, err := s.GetMethodologyCap(ctx, methodologyTokenID)
	if err != nil {
		return nil, err
	}
	remaining := cap.MaxSupply - cap.CurrentSupply
	if remaining < 0 {
		remaining = 0
	}
	threshold := int64(math.Ceil(float64(cap.MaxSupply) * s.nearLimitRatio))
	if threshold < 1 {
		threshold = 1
	}
	return &MethodologySupplyResponse{
		MethodologyTokenID: cap.MethodologyTokenID,
		MaxSupply:          cap.MaxSupply,
		CurrentSupply:      cap.CurrentSupply,
		RemainingSupply:    remaining,
		NearLimit:          cap.CurrentSupply >= threshold,
		NearLimitThreshold: threshold,
	}, nil
}

func (s *capEnforcementService) ValidateAndExecuteMint(ctx context.Context, input MintValidationInput, executeMint func(context.Context) error) (*MintingAttempt, error) {
	if input.RequestedAmount <= 0 {
		return nil, fmt.Errorf("requested amount must be positive")
	}
	if _, err := s.EnsureCapConfigured(ctx, input.MethodologyTokenID); err != nil {
		return nil, err
	}
	return s.repo.ValidateAndExecuteMint(ctx, input, executeMint)
}

func (s *capEnforcementService) GetMintingHistory(ctx context.Context, methodologyTokenID int, limit int) ([]MintingAttempt, error) {
	return s.repo.ListMintingAttemptsByMethodology(ctx, methodologyTokenID, limit)
}

func (s *capEnforcementService) GetProjectValidationHistory(ctx context.Context, projectID uuid.UUID, limit int) ([]MintingAttempt, error) {
	return s.repo.ListMintingAttemptsByProject(ctx, projectID, limit)
}

func (s *capEnforcementService) ListNearLimitCaps(ctx context.Context, thresholdRatio float64) ([]MethodologySupplyResponse, error) {
	if thresholdRatio <= 0 || thresholdRatio >= 1 {
		thresholdRatio = s.nearLimitRatio
	}
	caps, err := s.repo.ListCapsNearLimit(ctx, thresholdRatio)
	if err != nil {
		return nil, err
	}
	resp := make([]MethodologySupplyResponse, 0, len(caps))
	for _, cap := range caps {
		remaining := cap.MaxSupply - cap.CurrentSupply
		if remaining < 0 {
			remaining = 0
		}
		threshold := int64(math.Ceil(float64(cap.MaxSupply) * thresholdRatio))
		if threshold < 1 {
			threshold = 1
		}
		resp = append(resp, MethodologySupplyResponse{
			MethodologyTokenID: cap.MethodologyTokenID,
			MaxSupply:          cap.MaxSupply,
			CurrentSupply:      cap.CurrentSupply,
			RemainingSupply:    remaining,
			NearLimit:          cap.CurrentSupply >= threshold,
			NearLimitThreshold: threshold,
		})
	}
	return resp, nil
}

func (s *capEnforcementService) recordCapSource(ctx context.Context, methodologyTokenID int, sourceType, sourceReference string, payload map[string]any) error {
	if payload == nil {
		payload = map[string]any{}
	}
	rawJSON, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	source := &CapConfigurationSource{
		MethodologyTokenID: methodologyTokenID,
		SourceType:         strings.ToUpper(strings.TrimSpace(sourceType)),
		SourceReference:    strings.TrimSpace(sourceReference),
		CapConfiguration:   rawJSON,
		AppliedAt:          time.Now().UTC(),
	}
	if source.SourceType == "" {
		source.SourceType = CapSourceAdmin
	}
	return s.repo.RecordCapConfigurationSource(ctx, source)
}

func CreditsToCapUnits(amount float64) int64 {
	if amount <= 0 {
		return 0
	}
	// We round up so fractional issuance cannot bypass an integer cap limit.
	units := int64(math.Ceil(amount))
	if units < 1 {
		return 1
	}
	return units
}

func ParseThresholdRatio(raw string, defaultRatio float64) float64 {
	if strings.TrimSpace(raw) == "" {
		return defaultRatio
	}
	parsed, err := strconv.ParseFloat(strings.TrimSpace(raw), 64)
	if err != nil {
		return defaultRatio
	}
	if parsed <= 0 || parsed >= 1 {
		return defaultRatio
	}
	return parsed
}
