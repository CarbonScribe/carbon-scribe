package documents

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// ─── Workflow State Machine ────────────────────────────────────────────────────

// validTransitions defines the allowed Status changes and the role required to
// perform each transition. An empty required role means any authenticated user may.
var validTransitions = map[DocumentStatus][]WorkflowTransition{
	DocumentStatusDraft: {
		{To: DocumentStatusSubmitted, RequiredRole: ""},
	},
	DocumentStatusSubmitted: {
		{To: DocumentStatusUnderReview, RequiredRole: "reviewer"},
		{To: DocumentStatusDraft, RequiredRole: "reviewer"}, // send back
	},
	DocumentStatusUnderReview: {
		{To: DocumentStatusApproved, RequiredRole: "approver"},
		{To: DocumentStatusRejected, RequiredRole: "approver"},
		{To: DocumentStatusDraft, RequiredRole: "approver"}, // send back for rework
	},
}

// WorkflowTransition describes a single allowed status change.
type WorkflowTransition struct {
	To           DocumentStatus `json:"to"`
	RequiredRole string         `json:"required_role"`
}

// TransitionRequest is the JSON body for POST /api/v1/documents/:id/transition.
type TransitionRequest struct {
	To            DocumentStatus `json:"to" binding:"required"`
	Comment       string         `json:"comment"`
	PerformerRole string         `json:"performer_role"` // role of the requesting user
}

// TransitionResponse is returned after a successful state transition.
type TransitionResponse struct {
	DocumentID     uuid.UUID      `json:"document_id"`
	FromStatus     DocumentStatus `json:"from_status"`
	ToStatus       DocumentStatus `json:"to_status"`
	Comment        string         `json:"comment,omitempty"`
	TransitionedAt time.Time      `json:"transitioned_at"`
}

// AdvanceWorkflow validates the requested status transition and applies it.
func (s *Service) AdvanceWorkflow(ctx context.Context, docID uuid.UUID, req *TransitionRequest, userID *uuid.UUID) (*TransitionResponse, error) {
	doc, err := s.repo.FindByID(ctx, docID)
	if err != nil {
		return nil, fmt.Errorf("document not found: %w", err)
	}

	// Check that the target status is a valid next state from the current one.
	if err := validateTransition(doc.Status, req.To, req.PerformerRole); err != nil {
		return nil, err
	}

	fromStatus := doc.Status
	doc.Status = req.To

	if err := s.repo.Update(ctx, doc); err != nil {
		return nil, fmt.Errorf("failed to update document status: %w", err)
	}

	// Record the transition in the workflow steps (stored in the document_workflows table
	// if a workflow is attached) and in the access log.
	if doc.WorkflowID != nil {
		_ = s.repo.AppendWorkflowStep(ctx, *doc.WorkflowID, WorkflowStepEntry{
			Step:          fmt.Sprintf("%s → %s", fromStatus, req.To),
			PerformedBy:   userIDString(userID),
			PerformerRole: req.PerformerRole,
			Comment:       req.Comment,
			PerformedAt:   time.Now().UTC().Format(time.RFC3339),
		})
	}

	_ = s.repo.LogAccess(ctx, &DocumentAccessLog{
		DocumentID:  docID,
		UserID:      userID,
		Action:      AccessAction(fmt.Sprintf("STATUS_%s", req.To)),
		PerformedAt: time.Now().UTC(),
	})

	return &TransitionResponse{
		DocumentID:     docID,
		FromStatus:     fromStatus,
		ToStatus:       req.To,
		Comment:        req.Comment,
		TransitionedAt: time.Now().UTC(),
	}, nil
}

// GetWorkflowState returns the document's current status, available next states,
// and the full audit trail of workflow steps if a workflow is attached.
func (s *Service) GetWorkflowState(ctx context.Context, docID uuid.UUID) (*WorkflowStateResponse, error) {
	doc, err := s.repo.FindByID(ctx, docID)
	if err != nil {
		return nil, fmt.Errorf("document not found: %w", err)
	}

	available := validTransitions[doc.Status]

	resp := &WorkflowStateResponse{
		DocumentID:           docID,
		CurrentStatus:        doc.Status,
		AvailableTransitions: available,
	}

	if doc.WorkflowID != nil {
		wf, err := s.repo.FindWorkflowByID(ctx, *doc.WorkflowID)
		if err == nil {
			resp.WorkflowName = wf.Name
			resp.WorkflowSteps = wf.Steps
		}
	}

	return resp, nil
}

// WorkflowStateResponse is returned from GET /api/v1/documents/:id/workflow.
type WorkflowStateResponse struct {
	DocumentID           uuid.UUID            `json:"document_id"`
	CurrentStatus        DocumentStatus       `json:"current_status"`
	AvailableTransitions []WorkflowTransition `json:"available_transitions"`
	WorkflowName         string               `json:"workflow_name,omitempty"`
	WorkflowSteps        datatypes.JSON       `json:"workflow_steps,omitempty"`
}

// CreateWorkflowTemplate creates a new reusable workflow template.
func (s *Service) CreateWorkflowTemplate(ctx context.Context, req *CreateWorkflowTemplateRequest) (*DocumentWorkflow, error) {
	stepsJSON, err := json.Marshal(req.Steps)
	if err != nil {
		return nil, fmt.Errorf("failed to serialise steps: %w", err)
	}

	wf := &DocumentWorkflow{
		ID:           uuid.New(),
		Name:         req.Name,
		Description:  req.Description,
		DocumentType: DocumentType(req.DocumentType),
		Steps:        datatypes.JSON(stepsJSON),
	}

	if err := s.repo.CreateWorkflow(ctx, wf); err != nil {
		return nil, err
	}
	return wf, nil
}

// ListWorkflowTemplates returns all workflow templates.
func (s *Service) ListWorkflowTemplates(ctx context.Context) ([]DocumentWorkflow, error) {
	return s.repo.FindAllWorkflows(ctx)
}

// CreateWorkflowTemplateRequest is the JSON body for POST /api/v1/documents/workflows.
type CreateWorkflowTemplateRequest struct {
	Name         string                   `json:"name" binding:"required"`
	Description  string                   `json:"description"`
	DocumentType string                   `json:"document_type" binding:"required"`
	Steps        []map[string]interface{} `json:"steps"`
}

// WorkflowStepEntry is a single step recorded in the workflow audit trail.
type WorkflowStepEntry struct {
	Step          string `json:"step"`
	PerformedBy   string `json:"performed_by"`
	PerformerRole string `json:"performer_role"`
	Comment       string `json:"comment,omitempty"`
	PerformedAt   string `json:"performed_at"`
}

// ─── helpers ──────────────────────────────────────────────────────────────────

func validateTransition(current, target DocumentStatus, callerRole string) error {
	allowed, ok := validTransitions[current]
	if !ok {
		return fmt.Errorf("no transitions defined for status %q", current)
	}
	for _, t := range allowed {
		if t.To == target {
			if t.RequiredRole != "" && callerRole != t.RequiredRole {
				return fmt.Errorf("transition to %q requires role %q (got %q)", target, t.RequiredRole, callerRole)
			}
			return nil
		}
	}
	return fmt.Errorf("transition from %q to %q is not allowed", current, target)
}

func userIDString(id *uuid.UUID) string {
	if id == nil {
		return "anonymous"
	}
	return id.String()
}
