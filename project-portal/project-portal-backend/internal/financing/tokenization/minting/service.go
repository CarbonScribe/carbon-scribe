package minting

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	rpcclient "github.com/stellar/go/clients/rpcclient"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	protocol "github.com/stellar/go/protocols/rpc"
	"github.com/stellar/go/strkey"
	"github.com/stellar/go/txnbuild"
	"github.com/stellar/go/xdr"
	"gorm.io/gorm"
)

const (
	DefaultCarbonAssetContractID = "CAW7LUESK5RWH75W7IL64HYREFM5CPSFASBVVPVO2XOBC6AKHW4WJ6TM"
	defaultSorobanRPCURL         = "https://soroban-testnet.stellar.org:443"
)

// CarbonAssetMetadata represents the metadata for a carbon asset credit
type CarbonAssetMetadata struct {
	ProjectID     string
	VintageYear   uint64
	MethodologyID uint32
	GeoHash       [32]byte
}

type Service interface {
	MintProjectCredits(ctx context.Context, projectID uuid.UUID, verificationID *uuid.UUID) (*MintingJob, error)
	GetMintingStatus(ctx context.Context, projectID uuid.UUID) ([]MintingJob, []MintedToken, error)
}

type service struct {
	db             *gorm.DB
	contractClient CarbonAssetContractClient
	capValidator   *CapValidator
}

type CarbonAssetContractClient interface {
	Mint(ctx context.Context, owner string, metadata CarbonAssetMetadata) (tokenID int, txHash string, err error)
}

func NewService(db *gorm.DB, client CarbonAssetContractClient, capValidator *CapValidator) Service {
	if client == nil {
		client = NewContractClientFromEnv()
	}
	return &service{
		db:             db,
		contractClient: client,
		capValidator:   capValidator,
	}
}

func (s *service) MintProjectCredits(ctx context.Context, projectID uuid.UUID, verificationID *uuid.UUID) (*MintingJob, error) {
	// Create a new minting job
	job := &MintingJob{
		ProjectID:      projectID,
		VerificationID: verificationID,
		Status:         "pending",
	}

	if err := s.db.WithContext(ctx).Create(job).Error; err != nil {
		return nil, fmt.Errorf("create minting job: %w", err)
	}

	// Fetch project details for metadata
	// Normally we would have a project repository injected here,
	// but for now we'll query directly to avoid circular dependency
	// or complex injection if we're in the same transaction
	var project struct {
		ID                 uuid.UUID
		Name               string
		MethodologyTokenID int
		VintageYear        int
		CarbonCredits      int
	}
	if err := s.db.WithContext(ctx).Table("projects").Where("id = ?", projectID).First(&project).Error; err != nil {
		job.Status = "failed"
		job.Error = "project not found"
		s.db.Save(job)
		return nil, fmt.Errorf("fetch project for minting: %w", err)
	}

	// Async minting or immediate? Requirement says "handle failures with retry logic".
	// For now we'll do it synchronously here, but in a real app this would be a background task.
	go s.processMintingJob(context.Background(), job, project.MethodologyTokenID, project.VintageYear, project.CarbonCredits)

	return job, nil
}

func (s *service) processMintingJob(ctx context.Context, job *MintingJob, methodologyID int, vintageYear int, projectCredits int) {
	job.Status = "processing"
	s.db.Save(job)

	// In a real scenario, we would determine the owner physical address from the project wallet
	// Using a placeholder address for demonstration
	ownerAddress := os.Getenv("CARBON_ASSET_DEFAULT_PROJECT_OWNER")
	if ownerAddress == "" {
		ownerAddress = os.Getenv("CARBON_ASSET_AUTHORITY_PUBLIC_KEY")
	}
	if ownerAddress == "" {
		ownerAddress = os.Getenv("STELLAR_PUBLIC_KEY")
	}
	if strings.TrimSpace(ownerAddress) == "" {
		job.Status = "failed"
		job.Error = "missing CARBON_ASSET_DEFAULT_PROJECT_OWNER or CARBON_ASSET_AUTHORITY_PUBLIC_KEY"
		s.db.Save(job)
		return
	}

	// Calculate a simple GeoHash if not available (Placeholder)
	// In a real app, this would be the actual geospatial hash of the project boundaries
	geoHash := sha256.Sum256([]byte(job.ProjectID.String()))

	metadata := CarbonAssetMetadata{
		ProjectID:     job.ProjectID.String(),
		VintageYear:   2024,
		MethodologyID: uint32(methodologyID),
		GeoHash:       geoHash,
	}
	if vintageYear > 0 {
		metadata.VintageYear = uint64(vintageYear)
	}

	requestedAmount := int64(1)
	if projectCredits > 0 {
		requestedAmount = int64(projectCredits)
	}
	if requestedAmount <= 0 {
		requestedAmount = 1
	}

	var vintageYearPtr *int
	if metadata.VintageYear > 0 {
		v := int(metadata.VintageYear)
		vintageYearPtr = &v
	}

	// Retry logic
	var lastErr error
	for attempt := 1; attempt <= 3; attempt++ {
		var mintedTokenID int
		var mintedTxHash string
		mintFn := func(mintCtx context.Context) error {
			tokenID, txHash, err := s.contractClient.Mint(mintCtx, ownerAddress, metadata)
			if err != nil {
				return err
			}
			mintedTokenID = tokenID
			mintedTxHash = txHash
			return nil
		}

		err := s.capValidator.ValidateAndExecute(ctx, CapValidationInput{
			MethodologyTokenID: methodologyID,
			ProjectID:          job.ProjectID,
			VintageYear:        vintageYearPtr,
			RequestedAmount:    requestedAmount,
		}, mintFn)
		if err == nil {
			job.Status = "completed"
			job.TxHash = mintedTxHash
			s.db.Save(job)

			mintedToken := &MintedToken{
				JobID:         job.ID,
				TokenID:       mintedTokenID,
				ProjectID:     job.ProjectID,
				VintageYear:   int(metadata.VintageYear),
				MethodologyID: int(metadata.MethodologyID),
			}
			s.db.Create(mintedToken)
			return
		}
		lastErr = err
		time.Sleep(time.Duration(attempt) * 2 * time.Second)
	}

	job.Status = "failed"
	job.Error = lastErr.Error()
	s.db.Save(job)
}

func (s *service) GetMintingStatus(ctx context.Context, projectID uuid.UUID) ([]MintingJob, []MintedToken, error) {
	var jobs []MintingJob
	if err := s.db.WithContext(ctx).Where("project_id = ?", projectID).Find(&jobs).Error; err != nil {
		return nil, nil, err
	}

	var tokens []MintedToken
	if err := s.db.WithContext(ctx).Where("project_id = ?", projectID).Find(&tokens).Error; err != nil {
		return nil, nil, err
	}

	return jobs, tokens, nil
}

// Contract Client Implementation

type realContractClient struct {
	contractID        string
	rpcURL            string
	networkPassphrase string
	authority         *keypair.Full
	rpc               *rpcclient.Client
}

func NewContractClientFromEnv() CarbonAssetContractClient {
	contractID := strings.TrimSpace(os.Getenv("CARBON_ASSET_CONTRACT_ID"))
	if contractID == "" {
		contractID = DefaultCarbonAssetContractID
	}

	seed := strings.TrimSpace(os.Getenv("CARBON_ASSET_AUTHORITY_SECRET_KEY"))
	if seed == "" {
		seed = strings.TrimSpace(os.Getenv("STELLAR_SECRET_KEY"))
	}
	if seed == "" {
		// Mock implementation if no key provided
		return &mockContractClient{}
	}

	authority, err := keypair.ParseFull(seed)
	if err != nil {
		return &mockContractClient{}
	}
	rpcURL := os.Getenv("STELLAR_RPC_URL")
	if rpcURL == "" {
		rpcURL = defaultSorobanRPCURL
	}
	networkPass := os.Getenv("STELLAR_NETWORK_PASSPHRASE")
	if networkPass == "" {
		networkPass = network.TestNetworkPassphrase
	}

	return &realContractClient{
		contractID:        contractID,
		rpcURL:            rpcURL,
		networkPassphrase: networkPass,
		authority:         authority,
		rpc:               rpcclient.NewClient(rpcURL, http.DefaultClient),
	}
}

func (c *realContractClient) Mint(ctx context.Context, owner string, metadata CarbonAssetMetadata) (int, string, error) {
	if strings.TrimSpace(owner) == "" {
		owner = c.authority.Address()
	}

	// 1. Load Admin Account
	account, err := c.rpc.LoadAccount(ctx, c.authority.Address())
	if err != nil {
		return 0, "", fmt.Errorf("load authority account: %w", err)
	}

	// 2. Prepare Arguments
	callerVal, err := scAddressVal(c.authority.Address())
	if err != nil {
		return 0, "", err
	}
	ownerVal, err := scAddressVal(owner)
	if err != nil {
		return 0, "", err
	}
	metaVal, err := buildMetadataVal(metadata)
	if err != nil {
		return 0, "", err
	}

	// 3. Simulate Transaction
	op := txnbuild.InvokeHostFunction{
		HostFunction: xdr.HostFunction{
			Type: xdr.HostFunctionTypeHostFunctionTypeInvokeContract,
			InvokeContract: &xdr.InvokeContractArgs{
				ContractAddress: c.contractScAddress(),
				FunctionName:    xdr.ScSymbol("mint"),
				Args:            []xdr.ScVal{callerVal, ownerVal, metaVal},
			},
		},
		SourceAccount: c.authority.Address(),
	}

	tx, err := txnbuild.NewTransaction(txnbuild.TransactionParams{
		SourceAccount:        account,
		IncrementSequenceNum: true,
		Operations:           []txnbuild.Operation{&op},
		BaseFee:              txnbuild.MinBaseFee,
		Preconditions:        txnbuild.Preconditions{TimeBounds: txnbuild.NewTimeout(300)},
	})
	if err != nil {
		return 0, "", fmt.Errorf("build simulation transaction: %w", err)
	}

	encodedTx, err := tx.Base64()
	if err != nil {
		return 0, "", fmt.Errorf("encode simulation transaction: %w", err)
	}
	simReq := protocol.SimulateTransactionRequest{Transaction: encodedTx, Format: protocol.FormatBase64, AuthMode: protocol.AuthModeRecord}
	simResp, err := c.rpc.SimulateTransaction(ctx, simReq)
	if err != nil {
		return 0, "", fmt.Errorf("simulate mint transaction: %w", err)
	}
	if simResp.Error != "" {
		return 0, "", fmt.Errorf("mint simulation failed: %s", simResp.Error)
	}
	if simResp.RestorePreamble != nil {
		return 0, "", fmt.Errorf("mint simulation indicates restore preamble is required")
	}
	if len(simResp.Results) == 0 {
		return 0, "", fmt.Errorf("mint simulation returned no results")
	}

	if simResp.Results[0].AuthXDR != nil {
		authEntries, decodeErr := decodeAuthEntries(*simResp.Results[0].AuthXDR)
		if decodeErr != nil {
			return 0, "", decodeErr
		}
		op.Auth = authEntries
	}

	var txData xdr.SorobanTransactionData
	if err := xdr.SafeUnmarshalBase64(simResp.TransactionDataXDR, &txData); err != nil {
		return 0, "", fmt.Errorf("decode soroban transaction data: %w", err)
	}
	op.Ext = xdr.TransactionExt{V: 1, SorobanData: &txData}

	txToSend, err := txnbuild.NewTransaction(txnbuild.TransactionParams{
		SourceAccount:        account,
		IncrementSequenceNum: true,
		Operations:           []txnbuild.Operation{&op},
		BaseFee:              txnbuild.MinBaseFee + simResp.MinResourceFee,
		Preconditions:        txnbuild.Preconditions{TimeBounds: txnbuild.NewTimeout(300)},
	})
	if err != nil {
		return 0, "", fmt.Errorf("build submit transaction: %w", err)
	}

	signedTx, err := txToSend.Sign(c.networkPassphrase, c.authority)
	if err != nil {
		return 0, "", fmt.Errorf("sign transaction: %w", err)
	}
	envelope, err := signedTx.Base64()
	if err != nil {
		return 0, "", fmt.Errorf("encode signed transaction: %w", err)
	}

	sendResp, err := c.rpc.SendTransaction(ctx, protocol.SendTransactionRequest{Transaction: envelope, Format: protocol.FormatBase64})
	if err != nil {
		return 0, "", fmt.Errorf("submit mint transaction: %w", err)
	}
	if sendResp.ErrorResultXDR != "" {
		return 0, "", fmt.Errorf("mint submission failed with status %s", sendResp.Status)
	}

	txResp, err := c.waitForTransaction(ctx, sendResp.Hash)
	if err != nil {
		return 0, "", err
	}

	tokenID, err := extractMintTokenIDFromMeta(txResp.ResultMetaXDR)
	if err != nil {
		return 0, txResp.TransactionHash, err
	}

	return tokenID, txResp.TransactionHash, nil
}

func (c *realContractClient) waitForTransaction(ctx context.Context, hash string) (protocol.GetTransactionResponse, error) {
	for attempt := 0; attempt < 15; attempt++ {
		response, err := c.rpc.GetTransaction(ctx, protocol.GetTransactionRequest{Hash: hash, Format: protocol.FormatBase64})
		if err != nil {
			return protocol.GetTransactionResponse{}, fmt.Errorf("poll mint transaction %s: %w", hash, err)
		}
		switch response.Status {
		case protocol.TransactionStatusSuccess:
			return response, nil
		case protocol.TransactionStatusFailed:
			return protocol.GetTransactionResponse{}, fmt.Errorf("mint transaction %s failed on-chain", hash)
		case protocol.TransactionStatusNotFound:
		default:
			if strings.EqualFold(response.Status, "SUCCESS") {
				return response, nil
			}
		}

		select {
		case <-ctx.Done():
			return protocol.GetTransactionResponse{}, ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}
	return protocol.GetTransactionResponse{}, fmt.Errorf("mint transaction %s was not confirmed before timeout", hash)
}

func decodeAuthEntries(encoded []string) ([]xdr.SorobanAuthorizationEntry, error) {
	entries := make([]xdr.SorobanAuthorizationEntry, 0, len(encoded))
	for _, item := range encoded {
		var entry xdr.SorobanAuthorizationEntry
		if err := xdr.SafeUnmarshalBase64(item, &entry); err != nil {
			return nil, fmt.Errorf("decode soroban auth entry: %w", err)
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

func extractMintTokenIDFromMeta(resultMetaXDR string) (int, error) {
	var meta xdr.TransactionMeta
	if err := xdr.SafeUnmarshalBase64(resultMetaXDR, &meta); err != nil {
		return 0, fmt.Errorf("decode transaction meta: %w", err)
	}
	events, err := meta.GetContractEventsForOperation(0)
	if err != nil {
		return 0, fmt.Errorf("read contract events: %w", err)
	}
	for _, event := range events {
		if event.Type != xdr.ContractEventTypeContract {
			continue
		}
		body, ok := event.Body.GetV0()
		if !ok || len(body.Topics) < 2 {
			continue
		}
		if body.Topics[0].Type != xdr.ScValTypeScvSymbol || string(body.Topics[0].MustSym()) != "mint" {
			continue
		}
		if body.Topics[1].Type != xdr.ScValTypeScvU32 {
			continue
		}
		return int(body.Topics[1].MustU32()), nil
	}

	return 0, fmt.Errorf("mint event token id not found in transaction events")
}

func (c *realContractClient) contractScAddress() xdr.ScAddress {
	decoded, _ := strkey.Decode(strkey.VersionByteContract, c.contractID)
	var id xdr.ContractId
	copy(id[:], decoded)
	return xdr.ScAddress{Type: xdr.ScAddressTypeScAddressTypeContract, ContractId: &id}
}

func scAddressVal(address string) (xdr.ScVal, error) {
	accountID, err := xdr.AddressToAccountId(address)
	if err == nil {
		return xdr.NewScVal(xdr.ScValTypeScvAddress, xdr.ScAddress{Type: xdr.ScAddressTypeScAddressTypeAccount, AccountId: &accountID})
	}
	return xdr.ScVal{}, errors.New("invalid address")
}

func buildMetadataVal(meta CarbonAssetMetadata) (xdr.ScVal, error) {
	entries := xdr.ScMap{
		{Key: symbolVal("project_id"), Val: stringVal(meta.ProjectID)},
		{Key: symbolVal("vintage_year"), Val: u64Val(meta.VintageYear)},
		{Key: symbolVal("methodology_id"), Val: u32Val(meta.MethodologyID)},
		{Key: symbolVal("geo_hash"), Val: bytes32Val(meta.GeoHash)},
	}
	return xdr.NewScVal(xdr.ScValTypeScvMap, &entries)
}

func symbolVal(s string) xdr.ScVal {
	scVal, _ := xdr.NewScVal(xdr.ScValTypeScvSymbol, xdr.ScSymbol(s))
	return scVal
}

func stringVal(s string) xdr.ScVal {
	scVal, _ := xdr.NewScVal(xdr.ScValTypeScvString, xdr.ScString(s))
	return scVal
}

func u64Val(u uint64) xdr.ScVal {
	scVal, _ := xdr.NewScVal(xdr.ScValTypeScvU64, xdr.Uint64(u))
	return scVal
}

func u32Val(u uint32) xdr.ScVal {
	scVal, _ := xdr.NewScVal(xdr.ScValTypeScvU32, xdr.Uint32(u))
	return scVal
}

func bytes32Val(b [32]byte) xdr.ScVal {
	scVal, _ := xdr.NewScVal(xdr.ScValTypeScvBytes, xdr.ScBytes(b[:]))
	return scVal
}

// Mock implementation for development
type mockContractClient struct{}

func (m *mockContractClient) Mint(ctx context.Context, owner string, metadata CarbonAssetMetadata) (int, string, error) {
	time.Sleep(1 * time.Second)
	return int(time.Now().Unix() % 10000), "MOCK_TX_HASH_" + metadata.ProjectID, nil
}
