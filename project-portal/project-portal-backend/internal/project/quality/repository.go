package quality

import (
	"context"
)

// Repository for project quality scoring

type Repository interface {
	GetScore(ctx context.Context, projectID string) (*ProjectQualityScore, error)
	GetScoreHistory(ctx context.Context, projectID string) ([]QualityScoreHistory, error)
	SaveScore(ctx context.Context, score *ProjectQualityScore) error
	AddScoreHistory(ctx context.Context, history *QualityScoreHistory) error
	ListTopScores(ctx context.Context, limit int) ([]ProjectQualityScore, error)
	GetScoringRules(ctx context.Context) ([]ScoringRule, error)
	UpdateScoringRule(ctx context.Context, rule *ScoringRule) error
}
