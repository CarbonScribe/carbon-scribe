package quality

import (
	"context"
)

// Core service for project quality scoring

type Service interface {
	GetProjectScore(ctx context.Context, projectID string) (*ProjectQualityScore, error)
	GetScoreHistory(ctx context.Context, projectID string) ([]QualityScoreHistory, error)
	RecalculateScore(ctx context.Context, projectID string, adminID string) (*ProjectQualityScore, error)
	ListTopScores(ctx context.Context, limit int) ([]ProjectQualityScore, error)
	SyncScoresToContract(ctx context.Context) error
}
