package quality_test

import (
	"context"
	"testing"
	"time"

	"github.com/CarbonScribe/carbon-scribe/project-portal/project-portal-backend/internal/project/quality"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// ─── Mock repository ─────────────────────────────────────────────────────────

type mockRepo struct{ mock.Mock }

func (m *mockRepo) UpsertScore(ctx context.Context, s *quality.ProjectQualityScore) error {
	return m.Called(ctx, s).Error(0)
}
func (m *mockRepo) GetScoreByProject(ctx context.Context, pid uuid.UUID) (*quality.ProjectQualityScore, error) {
	args := m.Called(ctx, pid)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*quality.ProjectQualityScore), args.Error(1)
}
func (m *mockRepo) GetScoreHistory(ctx context.Context, pid uuid.UUID, limit int) ([]quality.QualityScoreHistory, error) {
	args := m.Called(ctx, pid, limit)
	return args.Get(0).([]quality.QualityScoreHistory), args.Error(1)
}
func (m *mockRepo) AppendHistory(ctx context.Context, h *quality.QualityScoreHistory) error {
	return m.Called(ctx, h).Error(0)
}
func (m *mockRepo) GetActiveRulesByType(ctx context.Context, ruleType string) ([]quality.ScoringRule, error) {
	args := m.Called(ctx, ruleType)
	return args.Get(0).([]quality.ScoringRule), args.Error(1)
}
func (m *mockRepo) GetAllScoresRanked(ctx context.Context) ([]quality.RankingEntry, error) {
	args := m.Called(ctx)
	return args.Get(0).([]quality.RankingEntry), args.Error(1)
}
func (m *mockRepo) GetAllProjectScores(ctx context.Context) ([]quality.ProjectQualityScore, error) {
	args := m.Called(ctx)
	return args.Get(0).([]quality.ProjectQualityScore), args.Error(1)
}

// ─── Scoring rules service tests ─────────────────────────────────────────────

func TestScoringRulesService_EvaluateRegistry_DBRule(t *testing.T) {
	repo := &mockRepo{}
	svc := quality.NewScoringRulesService(repo)

	repo.On("GetActiveRulesByType", mock.Anything, quality.RuleTypeRegistry).Return([]quality.ScoringRule{
		{
			RuleType:  quality.RuleTypeRegistry,
			Condition: map[string]interface{}{"registry": "Verra"},
			Points:    30,
		},
	}, nil)

	pts, err := svc.EvaluateRegistry(context.Background(), "Verra")
	require.NoError(t, err)
	assert.Equal(t, 30, pts)
}

func TestScoringRulesService_EvaluateRegistry_FallbackGoldStandard(t *testing.T) {
	repo := &mockRepo{}
	svc := quality.NewScoringRulesService(repo)

	// No DB rules — falls through to hard-coded table.
	repo.On("GetActiveRulesByType", mock.Anything, quality.RuleTypeRegistry).Return([]quality.ScoringRule{}, nil)

	pts, err := svc.EvaluateRegistry(context.Background(), "Gold Standard")
	require.NoError(t, err)
	assert.Equal(t, 30, pts)
}

func TestScoringRulesService_EvaluateRegistry_FallbackUnknown(t *testing.T) {
	repo := &mockRepo{}
	svc := quality.NewScoringRulesService(repo)

	repo.On("GetActiveRulesByType", mock.Anything, quality.RuleTypeRegistry).Return([]quality.ScoringRule{}, nil)

	pts, err := svc.EvaluateRegistry(context.Background(), "UnknownRegistry")
	require.NoError(t, err)
	assert.Equal(t, 5, pts)
}

func TestScoringRulesService_EvaluateMethodology(t *testing.T) {
	tests := []struct {
		name     string
		mtype    string
		expected int
	}{
		{"Afforestation", "Afforestation", 20},
		{"Reforestation", "Reforestation", 20},
		{"IFM", "IFM", 18},
		{"Agroforestry", "Agroforestry", 15},
		{"Soil Carbon", "Soil Carbon", 12},
		{"Unknown", "Biochar", 8},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			repo := &mockRepo{}
			repo.On("GetActiveRulesByType", mock.Anything, quality.RuleTypeMethodology).Return([]quality.ScoringRule{}, nil)

			svc := quality.NewScoringRulesService(repo)
			pts, err := svc.EvaluateMethodology(context.Background(), tc.mtype)
			require.NoError(t, err)
			assert.Equal(t, tc.expected, pts)
		})
	}
}

func TestScoringRulesService_EvaluateVersion(t *testing.T) {
	tests := []struct {
		version  string
		expected int
	}{
		{"v2", 15},
		{"v3", 15},
		{"v1", 8},
		{"", 10},
	}

	for _, tc := range tests {
		t.Run(tc.version, func(t *testing.T) {
			repo := &mockRepo{}
			repo.On("GetActiveRulesByType", mock.Anything, quality.RuleTypeVersion).Return([]quality.ScoringRule{}, nil)

			svc := quality.NewScoringRulesService(repo)
			pts, err := svc.EvaluateVersion(context.Background(), tc.version)
			require.NoError(t, err)
			assert.Equal(t, tc.expected, pts)
		})
	}
}

func TestScoringRulesService_EvaluateDocumentation(t *testing.T) {
	repo := &mockRepo{}
	repo.On("GetActiveRulesByType", mock.Anything, quality.RuleTypeDocumentation).Return([]quality.ScoringRule{}, nil)

	svc := quality.NewScoringRulesService(repo)

	pts, err := svc.EvaluateDocumentation(context.Background(), "QmXYZ...")
	require.NoError(t, err)
	assert.Equal(t, 15, pts)

	pts, err = svc.EvaluateDocumentation(context.Background(), "")
	require.NoError(t, err)
	assert.Equal(t, 0, pts)
}

func TestScoringRulesService_EvaluateAuthority(t *testing.T) {
	repo := &mockRepo{}
	repo.On("GetActiveRulesByType", mock.Anything, quality.RuleTypeAuthority).Return([]quality.ScoringRule{}, nil)

	svc := quality.NewScoringRulesService(repo)

	pts, err := svc.EvaluateAuthority(context.Background(), "GABCD...", true)
	require.NoError(t, err)
	assert.Equal(t, 20, pts)

	pts, err = svc.EvaluateAuthority(context.Background(), "GABCD...", false)
	require.NoError(t, err)
	assert.Equal(t, 0, pts)
}

// ─── ScoreLabel tests ─────────────────────────────────────────────────────────

func TestScoreLabel(t *testing.T) {
	assert.Equal(t, "High",   quality.ScoreLabel(100))
	assert.Equal(t, "High",   quality.ScoreLabel(80))
	assert.Equal(t, "Medium", quality.ScoreLabel(79))
	assert.Equal(t, "Medium", quality.ScoreLabel(50))
	assert.Equal(t, "Low",    quality.ScoreLabel(49))
	assert.Equal(t, "Low",    quality.ScoreLabel(0))
}

// ─── GetProjectScore service test ─────────────────────────────────────────────

func TestQualityScoringService_GetProjectScore(t *testing.T) {
	repo := &mockRepo{}
	rules := quality.NewScoringRulesService(repo)
	// No methodology client needed for read-only test.
	svc := quality.NewQualityScoringService(repo, rules, nil)

	projectID := uuid.New()
	now := time.Now().UTC()
	stored := &quality.ProjectQualityScore{
		ID:           uuid.New(),
		ProjectID:    projectID,
		OverallScore: 85,
		CalculatedAt: now,
	}
	repo.On("GetScoreByProject", mock.Anything, projectID).Return(stored, nil)

	resp, err := svc.GetProjectScore(context.Background(), projectID)
	require.NoError(t, err)
	assert.Equal(t, 85, resp.OverallScore)
	assert.Equal(t, "High", resp.ScoreLabel)
}

// ─── GetQualityRanking service test ───────────────────────────────────────────

func TestQualityScoringService_GetQualityRanking(t *testing.T) {
	repo := &mockRepo{}
	svc := quality.NewQualityScoringService(repo, quality.NewScoringRulesService(repo), nil)

	entries := []quality.RankingEntry{
		{ProjectID: uuid.New(), ProjectName: "Alpha", OverallScore: 90, ScoreLabel: "High"},
		{ProjectID: uuid.New(), ProjectName: "Beta", OverallScore: 60, ScoreLabel: "Medium"},
	}
	repo.On("GetAllScoresRanked", mock.Anything).Return(entries, nil)

	ranking, err := svc.GetQualityRanking(context.Background())
	require.NoError(t, err)
	assert.Len(t, ranking, 2)
	assert.Equal(t, 90, ranking[0].OverallScore)
}