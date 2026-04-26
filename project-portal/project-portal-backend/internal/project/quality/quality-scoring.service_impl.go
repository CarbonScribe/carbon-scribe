package quality

import (
	"carbon-scribe/project-portal/project-portal-backend/internal/project/methodology"
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Example implementation of Service (stub)
type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) GetProjectScore(ctx context.Context, projectID string) (*ProjectQualityScore, error) {
	return s.repo.GetScore(ctx, projectID)
}

func (s *service) GetScoreHistory(ctx context.Context, projectID string) ([]QualityScoreHistory, error) {
	return s.repo.GetScoreHistory(ctx, projectID)
}

func (s *service) RecalculateScore(ctx context.Context, projectID string, adminID string) (*ProjectQualityScore, error) {
	// 1. Fetch project methodology registration
	methRepo := methodology.NewRepository(nil) // TODO: inject real DB
	reg, err := methRepo.GetProjectMethodology(ctx, parseUUID(projectID))
	if err != nil {
		return nil, fmt.Errorf("failed to get project methodology: %w", err)
	}

	// 2. Query methodology metadata from contract
	meta := reg // fallback to DB fields
	// Optionally, fetch from contract if needed

	// 3. Evaluate scoring components
	components := map[string]int{}
	// Registry Authority
	registryScore := 0
	switch strings.ToLower(meta.Registry) {
	case "verra", "gold standard":
		registryScore = 30
	case "car", "plan vivo":
		registryScore = 20
	case "regional":
		registryScore = 10
	case "unknown", "":
		registryScore = 5
	default:
		registryScore = 5
	}
	components["registry"] = registryScore

	// Issuing Authority
	authorityScore := 0
	if meta.IssuingAuthority != "" {
		authorityScore = 20
	}
	components["authority"] = authorityScore

	// Methodology Type
	methodologyScore := 0
	switch strings.ToLower(meta.Name) {
	case "afforestation", "reforestation":
		methodologyScore = 20
	case "ifm":
		methodologyScore = 18
	case "agroforestry":
		methodologyScore = 15
	case "soil carbon":
		methodologyScore = 12
	default:
		methodologyScore = 0
	}
	components["methodology"] = methodologyScore

	// Version Recency
	versionScore := 0
	if strings.HasPrefix(strings.ToLower(meta.Version), "v2") {
		versionScore = 15
	} else if strings.HasPrefix(strings.ToLower(meta.Version), "v1") {
		versionScore = 8
	} else if meta.Version == "" {
		versionScore = 10
	}
	components["version"] = versionScore

	// Documentation (IPFS)
	documentationScore := 0
	if meta.IPFSCID != "" {
		documentationScore = 15
	}
	components["documentation"] = documentationScore

	// 4. Calculate overall score (sum, max 100)
	overall := registryScore + authorityScore + methodologyScore + versionScore + documentationScore
	if overall > 100 {
		overall = 100
	}

	now := time.Now().UTC()
	score := &ProjectQualityScore{
		ID: "", // to be set by DB
		ProjectID: projectID,
		MethodologyTokenID: reg.MethodologyTokenID,
		OverallScore: overall,
		Components: components,
		MethodologyScore: methodologyScore,
		AuthorityScore: authorityScore,
		RegistryScore: registryScore,
		VersionScore: versionScore,
		DocumentationScore: documentationScore,
		CalculatedAt: now,
		ValidUntil: nil,
	}
	// 5. Save score and history
	_ = s.repo.SaveScore(ctx, score) // ignore error for now
	_ = s.repo.AddScoreHistory(ctx, &QualityScoreHistory{
		ID: "", ProjectID: projectID, Score: overall, Components: components, Reason: "recalculation", ChangedBy: adminID, CreatedAt: now,
	})
	return score, nil
}

func parseUUID(id string) (uuid.UUID) {
	// naive parse, replace with proper error handling
	u, _ := uuid.Parse(id)
	return u
}

func (s *service) ListTopScores(ctx context.Context, limit int) ([]ProjectQualityScore, error) {
	return s.repo.ListTopScores(ctx, limit)
}

func (s *service) SyncScoresToContract(ctx context.Context) error {
	// TODO: Implement contract sync logic
	return fmt.Errorf("not implemented")
}
