package tokenization

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/stellar/go/clients/horizonclient"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	"github.com/stellar/go/txnbuild"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	pb "carbon-scribe/project-portal/project-portal-backend/pkg/stellar/soroban"
)

// StellarClient handles interactions with Stellar blockchain and Soroban smart contracts
type StellarClient struct {
	horizonClient     *horizonclient.Client
	sorobanClient     pb.SorobanClient
	issuerKeyPair     *keypair.Full
	networkPassphrase string
	config            *StellarConfig
}

// StellarConfig contains Stellar network configuration
type StellarConfig struct {
	HorizonURL      string `json:"horizon_url"`
	SorobanRPCURL   string `json:"soroban_rpc_url"`
	IssuerSecretKey string `json:"issuer_secret_key"`
	Network         string `json:"network"` // "testnet", "public", "futurenet"
	ContractAddress string `json:"contract_address"`
}

// CarbonAsset represents a carbon credit asset on Stellar
type CarbonAsset struct {
	Code     string `json:"code"`
	Issuer   string `json:"issuer"`
	Decimals int    `json:"decimals"`
}

// MintRequest represents a request to mint carbon credit tokens
type MintRequest struct {
	CreditID  string                 `json:"credit_id"`
	Amount    int64                  `json:"amount"`
	Recipient string                 `json:"recipient"`
	AssetCode string                 `json:"asset_code"`
	Metadata  map[string]interface{} `json:"metadata"`
}

// MintResponse represents the response from a mint operation
type MintResponse struct {
	TransactionHash string     `json:"transaction_hash"`
	TokenIDs        []string   `json:"token_ids"`
	LedgerSequence  uint32     `json:"ledger_sequence"`
	Successful      bool       `json:"successful"`
	ErrorMessage    string     `json:"error_message,omitempty"`
	SubmittedAt     time.Time  `json:"submitted_at"`
	ConfirmedAt     *time.Time `json:"confirmed_at,omitempty"`
}

// NewStellarClient creates a new Stellar client
func NewStellarClient(config *StellarConfig) (*StellarClient, error) {
	// Create Horizon client
	horizonClient := horizonclient.DefaultTestNetClient
	if config.Network == "public" {
		horizonClient = horizonclient.DefaultPublicNetClient
	} else if config.HorizonURL != "" {
		horizonClient = horizonclient.NewClient(config.HorizonURL)
	}

	// Parse issuer key pair
	issuerKeyPair, err := keypair.ParseFull(config.IssuerSecretKey)
	if err != nil {
		return nil, fmt.Errorf("failed to parse issuer key pair: %w", err)
	}

	// Create Soroban gRPC client
	var sorobanClient pb.SorobanClient
	if config.SorobanRPCURL != "" {
		conn, err := grpc.Dial(config.SorobanRPCURL, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			return nil, fmt.Errorf("failed to connect to Soroban RPC: %w", err)
		}
		sorobanClient = pb.NewSorobanClient(conn)
	}

	// Set network passphrase
	networkPassphrase := network.TestNetworkPassphrase
	if config.Network == "public" {
		networkPassphrase = network.PublicNetworkPassphrase
	}

	return &StellarClient{
		horizonClient:     horizonClient,
		sorobanClient:     sorobanClient,
		issuerKeyPair:     issuerKeyPair,
		networkPassphrase: networkPassphrase,
		config:            config,
	}, nil
}

// MintTokens mints carbon credit tokens using Soroban smart contract
func (s *StellarClient) MintTokens(ctx context.Context, req *MintRequest) (*MintResponse, error) {
	response := &MintResponse{
		SubmittedAt: time.Now(),
	}

	// Build Soroban transaction
	tx, err := s.buildMintTransaction(ctx, req)
	if err != nil {
		response.ErrorMessage = fmt.Sprintf("Failed to build transaction: %v", err)
		return response, err
	}

	// Sign transaction
	tx, err = tx.Sign(s.issuerKeyPair)
	if err != nil {
		response.ErrorMessage = fmt.Sprintf("Failed to sign transaction: %v", err)
		return response, fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Submit transaction to Stellar
	txResp, err := s.horizonClient.SubmitTransaction(tx)
	if err != nil {
		response.ErrorMessage = fmt.Sprintf("Failed to submit transaction: %v", err)
		return response, fmt.Errorf("failed to submit transaction: %w", err)
	}

	response.TransactionHash = txResp.Hash
	response.Successful = txResp.Successful

	if !txResp.Successful {
		if txResp.ResultXdr != "" {
			response.ErrorMessage = fmt.Sprintf("Transaction failed: %s", txResp.ResultXdr)
		} else {
			response.ErrorMessage = "Transaction failed with no result"
		}
		return response, fmt.Errorf("transaction failed: %s", response.ErrorMessage)
	}

	// Wait for transaction confirmation
	confirmedAt, err := s.waitForConfirmation(ctx, txResp.Hash)
	if err != nil {
		response.ErrorMessage = fmt.Sprintf("Transaction confirmation failed: %v", err)
		return response, fmt.Errorf("transaction confirmation failed: %w", err)
	}

	response.ConfirmedAt = &confirmedAt
	response.LedgerSequence = txResp.Ledger

	// Generate token IDs based on transaction hash and credit details
	tokenIDs := s.generateTokenIDs(req, txResp.Hash)
	response.TokenIDs = tokenIDs

	return response, nil
}

// buildMintTransaction builds a Soroban transaction for minting tokens
func (s *StellarClient) buildMintTransaction(ctx context.Context, req *MintRequest) (*txnbuild.Transaction, error) {
	// Get issuer account details
	account, err := s.horizonClient.AccountDetail(s.issuerKeyPair.Address())
	if err != nil {
		return nil, fmt.Errorf("failed to get issuer account: %w", err)
	}

	// Convert recipient address to keypair if needed
	recipientKP, err := keypair.ParseAddress(req.Recipient)
	if err != nil {
		return nil, fmt.Errorf("invalid recipient address: %w", err)
	}

	// Create Soroban invoke transaction
	contractArgs := map[string]interface{}{
		"function": "mint",
		"args": []interface{}{
			req.CreditID,          // credit identifier
			req.Amount,            // amount to mint
			recipientKP.Address(), // recipient address
			req.AssetCode,         // asset code
			req.Metadata,          // metadata
		},
	}

	// Convert args to XDR format (simplified for this example)
	argsXDR, err := json.Marshal(contractArgs)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal contract args: %w", err)
	}

	// Build the transaction
	tx := txnbuild.Transaction{
		SourceAccount: &account,
		Operations: []txnbuild.Operation{
			&txnbuild.InvokeHostFunction{
				HostFunction: txnbuild.HostFunction{
					Host: s.config.ContractAddress,
					Function: txnbuild.ContractFunction{
						Name: "mint",
						Args: argsXDR,
					},
				},
			},
		},
		Timebounds: txnbuild.NewTimeout(300),
		Network:    s.networkPassphrase,
	}

	// Build the transaction
	builtTx, err := tx.Build()
	if err != nil {
		return nil, fmt.Errorf("failed to build transaction: %w", err)
	}

	return builtTx, nil
}

// waitForConfirmation waits for a transaction to be confirmed on the ledger
func (s *StellarClient) waitForConfirmation(ctx context.Context, txHash string) (time.Time, error) {
	// Poll for transaction confirmation
	maxAttempts := 30 // 5 minutes with 10-second intervals
	for i := 0; i < maxAttempts; i++ {
		select {
		case <-ctx.Done():
			return time.Time{}, ctx.Err()
		default:
		}

		txResp, err := s.horizonClient.Transaction(txHash)
		if err == nil && txResp.Successful {
			return time.Now(), nil
		}

		if i < maxAttempts-1 {
			time.Sleep(10 * time.Second)
		}
	}

	return time.Time{}, fmt.Errorf("transaction confirmation timeout")
}

// generateTokenIDs generates unique token IDs for minted carbon credits
func (s *StellarClient) generateTokenIDs(req *MintRequest, txHash string) []string {
	// Generate token IDs based on transaction hash and credit details
	tokenIDs := make([]string, req.Amount)

	for i := int64(0); i < req.Amount; i++ {
		// Create unique token ID: creditID-txHash-index
		tokenID := fmt.Sprintf("%s-%s-%d", req.CreditID, txHash[:8], i)
		tokenIDs[i] = tokenID
	}

	return tokenIDs
}

// CreateCarbonAsset creates a new carbon credit asset on Stellar
func (s *StellarClient) CreateCarbonAsset(ctx context.Context, assetCode string, decimals int) (*CarbonAsset, error) {
	// Get issuer account details
	account, err := s.horizonClient.AccountDetail(s.issuerKeyPair.Address())
	if err != nil {
		return nil, fmt.Errorf("failed to get issuer account: %w", err)
	}

	// Create asset
	asset := txnbuild.CreditAsset{
		Code:   assetCode,
		Issuer: s.issuerKeyPair.Address(),
	}

	// Build transaction to create asset (this is a simplified example)
	tx := txnbuild.Transaction{
		SourceAccount: &account,
		Operations: []txnbuild.Operation{
			&txnbuild.SetOptions{
				SetFlags: []txnbuild.AccountFlag{txnbuild.AuthRequiredFlag},
			},
		},
		Timebounds: txnbuild.NewTimeout(300),
		Network:    s.networkPassphrase,
	}

	// Build and sign transaction
	builtTx, err := tx.Build()
	if err != nil {
		return nil, fmt.Errorf("failed to build asset creation transaction: %w", err)
	}

	builtTx, err = builtTx.Sign(s.issuerKeyPair)
	if err != nil {
		return nil, fmt.Errorf("failed to sign asset creation transaction: %w", err)
	}

	// Submit transaction
	_, err = s.horizonClient.SubmitTransaction(builtTx)
	if err != nil {
		return nil, fmt.Errorf("failed to submit asset creation transaction: %w", err)
	}

	return &CarbonAsset{
		Code:     assetCode,
		Issuer:   s.issuerKeyPair.Address(),
		Decimals: decimals,
	}, nil
}

// GetAssetBalance retrieves the balance of a carbon asset for an account
func (s *StellarClient) GetAssetBalance(ctx context.Context, accountID, assetCode string) (string, error) {
	account, err := s.horizonClient.AccountDetail(accountID)
	if err != nil {
		return "", fmt.Errorf("failed to get account details: %w", err)
	}

	// Find the balance for the specified asset
	for _, balance := range account.Balances {
		if asset, ok := balance.Asset.(txnbuild.CreditAsset); ok && asset.Code == assetCode && asset.Issuer == s.issuerKeyPair.Address() {
			return balance.Balance, nil
		}
	}

	return "0", nil
}

// GetTransactionStatus retrieves the status of a transaction
func (s *StellarClient) GetTransactionStatus(ctx context.Context, txHash string) (*TransactionStatus, error) {
	txResp, err := s.horizonClient.Transaction(txHash)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction: %w", err)
	}

	status := &TransactionStatus{
		Hash:       txResp.Hash,
		Successful: txResp.Successful,
		Ledger:     txResp.Ledger,
		CreatedAt:  txResp.CreatedAt,
		ResultXdr:  txResp.ResultXdr,
	}

	if txResp.Successful {
		status.Status = "completed"
	} else {
		status.Status = "failed"
		status.ErrorMessage = txResp.ResultXdr
	}

	return status, nil
}

// TransactionStatus represents the status of a Stellar transaction
type TransactionStatus struct {
	Hash         string    `json:"hash"`
	Status       string    `json:"status"`
	Successful   bool      `json:"successful"`
	Ledger       uint32    `json:"ledger"`
	CreatedAt    time.Time `json:"created_at"`
	ResultXdr    string    `json:"result_xdr"`
	ErrorMessage string    `json:"error_message,omitempty"`
}

// ValidateAssetCode validates that an asset code meets Stellar requirements
func (s *StellarClient) ValidateAssetCode(code string) error {
	if len(code) < 1 || len(code) > 12 {
		return fmt.Errorf("asset code must be 1-12 characters long")
	}

	// Check for valid characters (alphanumeric only)
	for _, char := range code {
		if !((char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9')) {
			return fmt.Errorf("asset code can only contain alphanumeric characters")
		}
	}

	return nil
}

// EstimateTransactionFee estimates the fee for a mint transaction
func (s *StellarClient) EstimateTransactionFee(ctx context.Context, req *MintRequest) (*TransactionFee, error) {
	// Get current fee stats from Horizon
	feeStats, err := s.horizonClient.FeeStats()
	if err != nil {
		return nil, fmt.Errorf("failed to get fee stats: %w", err)
	}

	// Base fee for Soroban transactions
	baseFee := feeStats.FeeCharged.Last

	// Additional fee for token minting (contract execution)
	mintingFee := int64(1000) // 0.0001 XLM

	// Total fee in stroops (1 XLM = 10,000,000 stroops)
	totalFee := baseFee + mintingFee

	return &TransactionFee{
		BaseFee:    baseFee,
		MintingFee: mintingFee,
		TotalFee:   totalFee,
		FeeInXLM:   float64(totalFee) / 10000000.0,
	}, nil
}

// TransactionFee represents fee information for a transaction
type TransactionFee struct {
	BaseFee    int64   `json:"base_fee"`
	MintingFee int64   `json:"minting_fee"`
	TotalFee   int64   `json:"total_fee"`
	FeeInXLM   float64 `json:"fee_in_xlm"`
}

// Close closes the Stellar client and cleans up resources
func (s *StellarClient) Close() error {
	if s.sorobanClient != nil {
		// Close gRPC connection if it exists
		if conn, ok := s.sorobanClient.(interface{ Close() error }); ok {
			return conn.Close()
		}
	}
	return nil
}
