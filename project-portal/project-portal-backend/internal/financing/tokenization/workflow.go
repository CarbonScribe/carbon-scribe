package tokenization

import (
	"context"
	"fmt"

	"carbon-scribe/project-portal/project-portal-backend/internal/project/methodology"

	"github.com/google/uuid"
)

type MintInput struct {
	ProjectID   uuid.UUID
	AssetCode   string
	AssetIssuer string
	Amount      float64
	BatchSize   int
}

type MintOutcome struct {
	TransactionHash    string
	TokenIDs           []string
	AssetCode          string
	AssetIssuer        string
	MethodologyTokenID int
	FinalStatus        string
}

type Workflow struct {
	client      Client
	monitor     *Monitor
	methService methodology.Service
}

func NewWorkflow(client Client, monitor *Monitor, methService methodology.Service) *Workflow {
	return &Workflow{client: client, monitor: monitor, methService: methService}
}

func (w *Workflow) Mint(ctx context.Context, input MintInput) (*MintOutcome, error) {
	// Fetch methodology token ID from project record
	methodologyID, err := w.methService.GetMethodologyTokenID(ctx, input.ProjectID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch methodology ID for project %s: %w", input.ProjectID, err)
	}
	if methodologyID <= 0 {
		return nil, fmt.Errorf("project %s has no valid methodology token ID linked", input.ProjectID)
	}

	resp, err := w.client.Mint(ctx, MintRequest{
		AssetCode:     input.AssetCode,
		AssetIssuer:   input.AssetIssuer,
		Amount:        input.Amount,
		BatchSize:     input.BatchSize,
		MethodologyID: methodologyID,
	})
	if err != nil {
		return nil, fmt.Errorf("mint transaction failed: %w", err)
	}
	finalStatus := w.monitor.ResolveFinalStatus("success")
	return &MintOutcome{
		TransactionHash:    resp.TransactionHash,
		TokenIDs:           resp.TokenIDs,
		AssetCode:          resp.AssetCode,
		AssetIssuer:        resp.AssetIssuer,
		MethodologyTokenID: methodologyID,
		FinalStatus:        finalStatus,
	}, nil
}
