package documents

import (
	"context"
)

type WorkflowService struct {
	repo Repository
}

func NewWorkflowService(repo Repository) *WorkflowService {
	return &WorkflowService{repo: repo}
}

func (s *WorkflowService) Transition(ctx context.Context, docID string, action string, userID string) error {
	// 1. Get document
	// 2. Get workflow
	// 3. Check if action is allowed in current state
	// 4. Update document status
	// This is a simplified implementation
	return nil
}

func (s *WorkflowService) GetNextStates(status DocumentStatus) []DocumentStatus {
	switch status {
	case StatusDraft:
		return []DocumentStatus{StatusSubmitted}
	case StatusSubmitted:
		return []DocumentStatus{StatusUnderReview}
	case StatusUnderReview:
		return []DocumentStatus{StatusApproved, StatusRejected}
	default:
		return nil
	}
}

func (s *WorkflowService) IsTransitionAllowed(current, next DocumentStatus) bool {
	nextStates := s.GetNextStates(current)
	for _, s := range nextStates {
		if s == next {
			return true
		}
	}
	return false
}
