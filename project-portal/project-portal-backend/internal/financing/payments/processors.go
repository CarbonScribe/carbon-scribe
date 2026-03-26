package payments

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

type InitiationRequest struct {
	Amount          float64
	Currency        string
	PaymentMethod   string
	PaymentProvider string
}

type InitiationResponse struct {
	ExternalID string
	Status     string
	Raw        map[string]interface{}
}

type Processor interface {
	Initiate(ctx context.Context, req InitiationRequest) (*InitiationResponse, error)
}

type MockProcessor struct{}

func NewMockProcessor() Processor {
	return &MockProcessor{}
}

func (p *MockProcessor) Initiate(ctx context.Context, req InitiationRequest) (*InitiationResponse, error) {
	if req.Amount <= 0 {
		return nil, fmt.Errorf("amount must be greater than zero")
	}
	provider := strings.ToLower(strings.TrimSpace(req.PaymentProvider))
	if provider == "" {
		provider = "stripe"
	}
	status := "processing"
	if provider == "stellar_network" || provider == "stellar" {
		status = "completed"
	}
	return &InitiationResponse{
		ExternalID: fmt.Sprintf("pay_%s", strings.ReplaceAll(uuid.NewString(), "-", "")),
		Status:     status,
		Raw: map[string]interface{}{
			"provider": provider,
			"method":   req.PaymentMethod,
		},
	}, nil
}
