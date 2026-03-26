package tokenization

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

type MintRequest struct {
	AssetCode     string
	AssetIssuer   string
	Amount        float64
	BatchSize     int
	MethodologyID int // Token ID from Methodology Library
}

type MintResponse struct {
	TransactionHash string
	TokenIDs        []string
	AssetCode       string
	AssetIssuer     string
}

type Client interface {
	Mint(ctx context.Context, req MintRequest) (*MintResponse, error)
}

type MockStellarClient struct{}

func NewMockStellarClient() Client {
	return &MockStellarClient{}
}

func (c *MockStellarClient) Mint(ctx context.Context, req MintRequest) (*MintResponse, error) {
	if req.Amount <= 0 {
		return nil, fmt.Errorf("amount must be greater than zero")
	}
	if req.MethodologyID <= 0 {
		return nil, fmt.Errorf("invalid methodology token ID")
	}
	if req.BatchSize <= 0 {
		req.BatchSize = 1
	}
	assetCode := strings.TrimSpace(req.AssetCode)
	if assetCode == "" {
		assetCode = "CARBON"
	}
	issuer := strings.TrimSpace(req.AssetIssuer)
	if issuer == "" {
		issuer = "GMOCKCARBONSCRIBEISSUERACCOUNT000000000000000000000000"
	}
	tokenCount := int(req.Amount)
	if tokenCount < 1 {
		tokenCount = 1
	}
	tokenIDs := make([]string, 0, tokenCount)
	for i := 0; i < tokenCount; i++ {
		tokenIDs = append(tokenIDs, fmt.Sprintf("tok-%s", uuid.NewString()))
	}
	return &MintResponse{
		TransactionHash: strings.ReplaceAll(uuid.NewString(), "-", ""),
		TokenIDs:        tokenIDs,
		AssetCode:       assetCode,
		AssetIssuer:     issuer,
	}, nil
}
