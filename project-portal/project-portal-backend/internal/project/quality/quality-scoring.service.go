package quality

import (
	"context"
	"fmt"
	"time"

	"github.com/CarbonScribe/carbon-scribe/project-portal/project-portal-backend/internal/integration/stellar"
	"github.com/google/uuid"
)

// QualityScoringService orchestrates score calculation, persistence, and history.
type QualityScoringService struct {
	repo              ScoreRepository
	rules             *ScoringRulesService
	methodologyClient *stellar.MethodologyClient
}

func NewQualityScoringService(
	repo ScoreRepository,
	rules *ScoringRulesService,
	methodologyClient *stellar.MethodologyClient,
) *QualityScoringService {
	return &QualityScoringService{
		repo:              repo,
		rules:             rules,
		methodologyClient: methodologyClient,
	}
}

// GetProjectScore returns the current quality score for a project.
func (s *QualityScoringService) GetProjectScore(ctx context.Context, projectID uuid.UUID) (*QualityScoreResponse, error) {
	score, err := s.repo.GetScoreByProject(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("get project score: %w", err)
	}
	return &QualityScoreResponse{
		ProjectQualityScore: *score,
		ScoreLabel:          ScoreLabel(score.OverallScore),
	}, nil
}

// GetScoreHistory returns the historical score changes for a project.
func (s *QualityScoringService) GetScoreHistory(ctx context.Context, projectID uuid.UUID) ([]QualityScoreHistory, error) {
	return s.repo.GetScoreHistory(ctx, projectID, 50)
}

// GetMethodologyBaseScore calculates a score for a methodology token without
// tying it to a specific project — useful for the methodology listing endpoint.
func (s *QualityScoringService) GetMethodologyBaseScore(ctx context.Context, tokenID int) (*QualityScoreResponse, error) {
	meta, err := s.methodologyClient.GetMethodologyMetadata(ctx, tokenID)
	if err != nil {
		return nil, fmt.Errorf("fetch methodology %d metadata: %w", tokenID, err)
	}

	score, err := s.calculateFromMetadata(ctx, uuid.Nil, tokenID, meta)
	if err != nil {
		return nil, err
	}
	return &QualityScoreResponse{
		ProjectQualityScore: *score,
		ScoreLabel:          ScoreLabel(score.OverallScore),
	}, nil
}

// RecalculateProjectScore (re)computes a score from on-chain methodology metadata,
// persists it, and appends a history record.
func (s *QualityScoringService) RecalculateProjectScore(
	ctx context.Context,
	projectID uuid.UUID,
	methodologyTokenID int,
	req RecalculateRequest,
) (*QualityScoreResponse, error) {
	meta, err := s.methodologyClient.GetMethodologyMetadata(ctx, methodologyTokenID)
	if err != nil {
		return nil, fmt.Errorf("fetch methodology metadata: %w", err)
	}

	score, err := s.calculateFromMetadata(ctx, projectID, methodologyTokenID, meta)
	if err != nil {
		return nil, err
	}

	if err := s.repo.UpsertScore(ctx, score); err != nil {
		return nil, fmt.Errorf("persist score: %w", err)
	}

	history := &QualityScoreHistory{
		ProjectID:  projectID,
		Score:      score.OverallScore,
		Components: score.Components,
		Reason:     req.Reason,
		ChangedBy:  req.ChangedBy,
	}
	if err := s.repo.AppendHistory(ctx, history); err != nil {
		// Non-fatal: log but don't fail the recalculation.
		fmt.Printf("warn: append history for project %s: %v\n", projectID, err)
	}

	return &QualityScoreResponse{
		ProjectQualityScore: *score,
		ScoreLabel:          ScoreLabel(score.OverallScore),
	}, nil
}

// GetQualityRanking returns all projects ordered by quality score.
func (s *QualityScoringService) GetQualityRanking(ctx context.Context) ([]RankingEntry, error) {
	return s.repo.GetAllScoresRanked(ctx)
}

// calculateFromMetadata is the pure scoring logic. Returns an unsaved score struct.
func (s *QualityScoringService) calculateFromMetadata(
	ctx context.Context,
	projectID uuid.UUID,
	tokenID int,
	meta *stellar.MethodologyMetadata,
) (*ProjectQualityScore, error) {
	registryScore, err := s.rules.EvaluateRegistry(ctx, meta.RegistryAuthority)
	if err != nil {
		return nil, err
	}

	authorityScore, err := s.rules.EvaluateAuthority(ctx, meta.IssuingAuthority, meta.AuthorityVerified)
	if err != nil {
		return nil, err
	}

	methodologyScore, err := s.rules.EvaluateMethodology(ctx, meta.MethodologyType)
	if err != nil {
		return nil, err
	}

	versionScore, err := s.rules.EvaluateVersion(ctx, meta.Version)
	if err != nil {
		return nil, err
	}

	documentationScore, err := s.rules.EvaluateDocumentation(ctx, meta.IPFSDocumentCID)
	if err != nil {
		return nil, err
	}

	overall := registryScore + authorityScore + methodologyScore + versionScore + documentationScore
	if overall > 100 {
		overall = 100
	}

	validUntil := time.Now().UTC().Add(30 * 24 * time.Hour) // default validity: 30 days
	return &ProjectQualityScore{
		ProjectID:          projectID,
		MethodologyTokenID: tokenID,
		OverallScore:       overall,
		Components: ScoreComponents{
			Registry:      registryScore,
			Authority:     authorityScore,
			Methodology:   methodologyScore,
			Version:       versionScore,
			Documentation: documentationScore,
		},
		RegistryScore:      registryScore,
		AuthorityScore:     authorityScore,
		MethodologyScore:   methodologyScore,
		VersionScore:       versionScore,
		DocumentationScore: documentationScore,
		ValidUntil:         &validUntil,
	}, nil
}