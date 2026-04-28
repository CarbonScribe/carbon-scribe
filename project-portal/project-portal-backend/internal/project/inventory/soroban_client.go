package inventory

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// SorobanClient defines the interface for querying the Carbon Asset contract
type SorobanClient interface {
	BalanceOf(ctx context.Context, owner string) (int64, error)
	TokensOfOwner(ctx context.Context, owner string) ([]uint32, error)
	GetMetadata(ctx context.Context, tokenID uint32) (*CreditMetadata, error)
	GetStatus(ctx context.Context, tokenID uint32) (AssetStatus, error)
	GetQualityScore(ctx context.Context, tokenID uint32) (int64, error)
	IsBurned(ctx context.Context, tokenID uint32) (bool, error)
}

// SorobanConfig holds configuration for Soroban RPC connection
type SorobanConfig struct {
	RPCURL            string
	NetworkPassphrase string
	ContractID        string
	RequestTimeout    time.Duration
}

// sorobanClient implements SorobanClient using Soroban RPC
type sorobanClient struct {
	config     SorobanConfig
	httpClient *http.Client
}

// NewSorobanClient creates a new Soroban RPC client
func NewSorobanClient(config SorobanConfig) SorobanClient {
	if config.RequestTimeout == 0 {
		config.RequestTimeout = 30 * time.Second
	}
	return &sorobanClient{
		config: config,
		httpClient: &http.Client{
			Timeout: config.RequestTimeout,
		},
	}
}

// rpcRequest represents a JSON-RPC request to Soroban RPC
type rpcRequest struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      int         `json:"id"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params,omitempty"`
}

// rpcResponse represents a JSON-RPC response from Soroban RPC
type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// simulateTransactionParams holds params for simulateTransaction RPC call
type simulateTransactionParams struct {
	Transaction string `json:"transaction"`
}

// simulateTransactionResult holds the result from simulateTransaction
type simulateTransactionResult struct {
	Results []struct {
		XDR string `json:"xdr"`
	} `json:"results"`
	Error string `json:"error,omitempty"`
}

func (c *sorobanClient) callRPC(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
	req := rpcRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  method,
		Params:  params,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.config.RPCURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var rpcResp rpcResponse
	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if rpcResp.Error != nil {
		return nil, fmt.Errorf("rpc error %d: %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}

	return rpcResp.Result, nil
}

func (c *sorobanClient) BalanceOf(ctx context.Context, owner string) (int64, error) {
	// Note: In production, this would build a proper Soroban transaction
	// to call the contract's balance_of function via simulateTransaction.
	// For now, we return an error indicating this requires an actual RPC call.
	return 0, fmt.Errorf("soroban RPC query not implemented - use mock client for development")
}

func (c *sorobanClient) TokensOfOwner(ctx context.Context, owner string) ([]uint32, error) {
	return nil, fmt.Errorf("soroban RPC query not implemented - use mock client for development")
}

func (c *sorobanClient) GetMetadata(ctx context.Context, tokenID uint32) (*CreditMetadata, error) {
	return nil, fmt.Errorf("soroban RPC query not implemented - use mock client for development")
}

func (c *sorobanClient) GetStatus(ctx context.Context, tokenID uint32) (AssetStatus, error) {
	return "", fmt.Errorf("soroban RPC query not implemented - use mock client for development")
}

func (c *sorobanClient) GetQualityScore(ctx context.Context, tokenID uint32) (int64, error) {
	return 0, fmt.Errorf("soroban RPC query not implemented - use mock client for development")
}

func (c *sorobanClient) IsBurned(ctx context.Context, tokenID uint32) (bool, error) {
	return false, fmt.Errorf("soroban RPC query not implemented - use mock client for development")
}

// MockSorobanClient provides a mock implementation for testing and development
type MockSorobanClient struct {
	tokens map[uint32]*mockToken
	owners map[string][]uint32
}

type mockToken struct {
	owner        string
	status       AssetStatus
	metadata     CreditMetadata
	qualityScore int64
	burned       bool
}

// NewMockSorobanClient creates a mock client with sample data
func NewMockSorobanClient() SorobanClient {
	client := &MockSorobanClient{
		tokens: make(map[uint32]*mockToken),
		owners: make(map[string][]uint32),
	}
	client.seedSampleData()
	return client
}

func (m *MockSorobanClient) seedSampleData() {
	sampleOwner := "GDEMO00000000000000000000000000000000000000000000000000"

	sampleTokens := []struct {
		id           uint32
		status       AssetStatus
		vintageYear  uint64
		methodology  uint32
		qualityScore int64
		burned       bool
	}{
		{1, StatusIssued, 2024, 1, 850, false},
		{2, StatusIssued, 2024, 1, 920, false},
		{3, StatusListed, 2024, 2, 780, false},
		{4, StatusRetired, 2023, 1, 890, false},
		{5, StatusRetired, 2023, 1, 850, true},
		{6, StatusLocked, 2024, 3, 910, false},
		{7, StatusIssued, 2025, 1, 950, false},
		{8, StatusInvalidated, 2022, 2, 0, false},
	}

	ownerTokens := make([]uint32, 0, len(sampleTokens))
	for _, t := range sampleTokens {
		m.tokens[t.id] = &mockToken{
			owner:  sampleOwner,
			status: t.status,
			metadata: CreditMetadata{
				ProjectID:     "PROJ-DEMO-001",
				VintageYear:   t.vintageYear,
				MethodologyID: t.methodology,
				GeoHash:       base64.StdEncoding.EncodeToString([]byte("sample-geohash")),
			},
			qualityScore: t.qualityScore,
			burned:       t.burned,
		}
		if !t.burned {
			ownerTokens = append(ownerTokens, t.id)
		}
	}
	m.owners[sampleOwner] = ownerTokens
}

func (m *MockSorobanClient) BalanceOf(ctx context.Context, owner string) (int64, error) {
	tokens, ok := m.owners[owner]
	if !ok {
		return 0, nil
	}
	return int64(len(tokens)), nil
}

func (m *MockSorobanClient) TokensOfOwner(ctx context.Context, owner string) ([]uint32, error) {
	tokens, ok := m.owners[owner]
	if !ok {
		return []uint32{}, nil
	}
	result := make([]uint32, len(tokens))
	copy(result, tokens)
	return result, nil
}

func (m *MockSorobanClient) GetMetadata(ctx context.Context, tokenID uint32) (*CreditMetadata, error) {
	token, ok := m.tokens[tokenID]
	if !ok {
		return nil, fmt.Errorf("token not found: %d", tokenID)
	}
	meta := token.metadata
	return &meta, nil
}

func (m *MockSorobanClient) GetStatus(ctx context.Context, tokenID uint32) (AssetStatus, error) {
	token, ok := m.tokens[tokenID]
	if !ok {
		return "", fmt.Errorf("token not found: %d", tokenID)
	}
	return token.status, nil
}

func (m *MockSorobanClient) GetQualityScore(ctx context.Context, tokenID uint32) (int64, error) {
	token, ok := m.tokens[tokenID]
	if !ok {
		return 0, fmt.Errorf("token not found: %d", tokenID)
	}
	return token.qualityScore, nil
}

func (m *MockSorobanClient) IsBurned(ctx context.Context, tokenID uint32) (bool, error) {
	token, ok := m.tokens[tokenID]
	if !ok {
		return false, fmt.Errorf("token not found: %d", tokenID)
	}
	return token.burned, nil
}

// AddMockToken adds a token to the mock client for testing
func (m *MockSorobanClient) AddMockToken(tokenID uint32, owner string, status AssetStatus, metadata CreditMetadata, qualityScore int64, burned bool) {
	m.tokens[tokenID] = &mockToken{
		owner:        owner,
		status:       status,
		metadata:     metadata,
		qualityScore: qualityScore,
		burned:       burned,
	}
	if !burned {
		m.owners[owner] = append(m.owners[owner], tokenID)
	}
}
