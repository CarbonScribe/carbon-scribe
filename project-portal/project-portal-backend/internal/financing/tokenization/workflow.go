package tokenization

import (
	"context"
	"fmt"
	"strconv"
	"strings"

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
	// Ensure project has a valid on-chain methodology token before minting credits.
	methodologyID, err := w.methService.ValidateProjectMethodology(ctx, input.ProjectID)
	if err != nil {
		return nil, fmt.Errorf("failed to validate methodology for project %s: %w", input.ProjectID, err)
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
		ProjectID:     input.ProjectID,
		VintageYear:   extractVintageYear(input.AssetCode),
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

// BuildTrustlineTransaction returns an unsigned ChangeTrust transaction for
// the buyer's wallet to sign, delegating to the underlying Stellar client.
func (w *Workflow) BuildTrustlineTransaction(ctx context.Context, req TrustlineRequest) (*TrustlineResponse, error) {
	return w.client.BuildTrustlineTransaction(ctx, req)
}

// HasTrustline reports whether accountAddress currently holds a trustline
// for the given asset, delegating to the underlying Stellar client.
func (w *Workflow) HasTrustline(ctx context.Context, accountAddress, assetCode, assetIssuer string) (bool, error) {
	return w.client.HasTrustline(ctx, accountAddress, assetCode, assetIssuer)
}

// AuthorizeTrustlineIfRequired issues issuer-side trustline authorization
// when the asset is configured as requiring it, delegating to the
// underlying Stellar client.
func (w *Workflow) AuthorizeTrustlineIfRequired(ctx context.Context, buyerAddress, assetCode string) error {
	return w.client.AuthorizeTrustlineIfRequired(ctx, buyerAddress, assetCode)
}

func extractVintageYear(assetCode string) int {
	trimmed := strings.TrimSpace(assetCode)
	if len(trimmed) < 4 {
		return 0
	}
	suffix := trimmed[len(trimmed)-4:]
	year, err := strconv.Atoi(suffix)
	if err != nil {
		return 0
	}
	if year < 1900 || year > 9999 {
		return 0
	}
	return year
}
