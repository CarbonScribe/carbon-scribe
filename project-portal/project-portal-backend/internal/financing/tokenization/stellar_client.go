package tokenization

import (
	"context"
	"crypto/sha256"
	"fmt"
	"math"
	"net/http"
	"os"
	"strconv"
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
)

const (
	DefaultCarbonAssetContractID = "CAW7LUESK5RWH75W7IL64HYREFM5CPSFASBVVPVO2XOBC6AKHW4WJ6TM"
	defaultSorobanRPCURL         = "https://soroban-testnet.stellar.org:443"
)

type MintRequest struct {
	AssetCode     string
	AssetIssuer   string
	Amount        float64
	BatchSize     int
	MethodologyID int // Token ID from Methodology Library
	ProjectID     uuid.UUID
	VintageYear   int
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

type RealStellarClient struct {
	contractID        string
	rpc               *rpcclient.Client
	networkPassphrase string
	authority         *keypair.Full
	pollInterval      time.Duration
	pollAttempts      int
}

type MockStellarClient struct{}

func NewClientFromEnv() Client {
	if strings.EqualFold(strings.TrimSpace(os.Getenv("CARBON_ASSET_USE_MOCK")), "true") {
		return &MockStellarClient{}
	}
	client, err := newRealClientFromEnv()
	if err != nil {
		return &MockStellarClient{}
	}
	return client
}

func newRealClientFromEnv() (*RealStellarClient, error) {
	seed := strings.TrimSpace(os.Getenv("CARBON_ASSET_AUTHORITY_SECRET_KEY"))
	if seed == "" {
		seed = strings.TrimSpace(os.Getenv("STELLAR_SECRET_KEY"))
	}
	if seed == "" {
		return nil, fmt.Errorf("missing CARBON_ASSET_AUTHORITY_SECRET_KEY or STELLAR_SECRET_KEY")
	}
	authority, err := keypair.ParseFull(seed)
	if err != nil {
		return nil, fmt.Errorf("parse authority key: %w", err)
	}

	contractID := strings.TrimSpace(os.Getenv("CARBON_ASSET_CONTRACT_ID"))
	if contractID == "" {
		contractID = DefaultCarbonAssetContractID
	}
	rpcURL := strings.TrimSpace(os.Getenv("STELLAR_RPC_URL"))
	if rpcURL == "" {
		rpcURL = defaultSorobanRPCURL
	}
	networkPassphrase := strings.TrimSpace(os.Getenv("STELLAR_NETWORK_PASSPHRASE"))
	if networkPassphrase == "" {
		networkPassphrase = network.TestNetworkPassphrase
	}

	pollAttempts := 15
	if raw := strings.TrimSpace(os.Getenv("CARBON_ASSET_POLL_ATTEMPTS")); raw != "" {
		if parsed, parseErr := strconv.Atoi(raw); parseErr == nil && parsed > 0 {
			pollAttempts = parsed
		}
	}

	return &RealStellarClient{
		contractID:        contractID,
		rpc:               rpcclient.NewClient(rpcURL, http.DefaultClient),
		networkPassphrase: networkPassphrase,
		authority:         authority,
		pollInterval:      2 * time.Second,
		pollAttempts:      pollAttempts,
	}, nil
}

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

func (c *RealStellarClient) Mint(ctx context.Context, req MintRequest) (*MintResponse, error) {
	if req.Amount <= 0 {
		return nil, fmt.Errorf("amount must be greater than zero")
	}
	if req.MethodologyID <= 0 {
		return nil, fmt.Errorf("invalid methodology token ID")
	}

	account, err := c.rpc.LoadAccount(ctx, c.authority.Address())
	if err != nil {
		return nil, fmt.Errorf("load authority account: %w", err)
	}

	callerVal, err := scAddressVal(c.authority.Address())
	if err != nil {
		return nil, err
	}
	owner := strings.TrimSpace(req.AssetIssuer)
	if owner == "" {
		owner = c.authority.Address()
	}
	ownerVal, err := scAddressVal(owner)
	if err != nil {
		return nil, err
	}
	metaVal, err := buildMetadataVal(req)
	if err != nil {
		return nil, err
	}

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
		return nil, fmt.Errorf("build simulation transaction: %w", err)
	}

	encodedTx, err := tx.Base64()
	if err != nil {
		return nil, fmt.Errorf("encode simulation transaction: %w", err)
	}

	simResp, err := c.rpc.SimulateTransaction(ctx, protocol.SimulateTransactionRequest{Transaction: encodedTx, Format: protocol.FormatBase64, AuthMode: protocol.AuthModeRecord})
	if err != nil {
		return nil, fmt.Errorf("simulate mint transaction: %w", err)
	}
	if simResp.Error != "" {
		return nil, fmt.Errorf("mint simulation failed: %s", simResp.Error)
	}
	if simResp.RestorePreamble != nil {
		return nil, fmt.Errorf("mint simulation indicates restore preamble is required")
	}
	if len(simResp.Results) == 0 {
		return nil, fmt.Errorf("mint simulation returned no results")
	}

	if simResp.Results[0].AuthXDR != nil {
		authEntries, decodeErr := decodeAuthEntries(*simResp.Results[0].AuthXDR)
		if decodeErr != nil {
			return nil, decodeErr
		}
		op.Auth = authEntries
	}

	var txData xdr.SorobanTransactionData
	if err := xdr.SafeUnmarshalBase64(simResp.TransactionDataXDR, &txData); err != nil {
		return nil, fmt.Errorf("decode soroban transaction data: %w", err)
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
		return nil, fmt.Errorf("build submit transaction: %w", err)
	}

	signedTx, err := txToSend.Sign(c.networkPassphrase, c.authority)
	if err != nil {
		return nil, fmt.Errorf("sign transaction: %w", err)
	}
	envelope, err := signedTx.Base64()
	if err != nil {
		return nil, fmt.Errorf("encode signed transaction: %w", err)
	}

	sendResp, err := c.rpc.SendTransaction(ctx, protocol.SendTransactionRequest{Transaction: envelope, Format: protocol.FormatBase64})
	if err != nil {
		return nil, fmt.Errorf("submit mint transaction: %w", err)
	}
	if sendResp.ErrorResultXDR != "" {
		return nil, fmt.Errorf("mint submission failed with status %s", sendResp.Status)
	}

	txResp, err := c.waitForTransaction(ctx, sendResp.Hash)
	if err != nil {
		return nil, err
	}

	tokenID, err := extractMintTokenIDFromMeta(txResp.ResultMetaXDR)
	if err != nil {
		return nil, err
	}
	tokenIDs := []string{fmt.Sprintf("tok-%d", tokenID)}
	return &MintResponse{
		TransactionHash: txResp.TransactionHash,
		TokenIDs:        tokenIDs,
		AssetCode:       strings.TrimSpace(req.AssetCode),
		AssetIssuer:     owner,
	}, nil
}

func (c *RealStellarClient) waitForTransaction(ctx context.Context, hash string) (protocol.GetTransactionResponse, error) {
	for attempt := 0; attempt < c.pollAttempts; attempt++ {
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
		case <-time.After(c.pollInterval):
		}
	}
	return protocol.GetTransactionResponse{}, fmt.Errorf("mint transaction %s was not confirmed before timeout", hash)
}

func (c *RealStellarClient) contractScAddress() xdr.ScAddress {
	decoded, _ := strkey.Decode(strkey.VersionByteContract, c.contractID)
	var id xdr.ContractId
	copy(id[:], decoded)
	return xdr.ScAddress{Type: xdr.ScAddressTypeScAddressTypeContract, ContractId: &id}
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

func scAddressVal(address string) (xdr.ScVal, error) {
	accountID, err := xdr.AddressToAccountId(address)
	if err == nil {
		return xdr.NewScVal(xdr.ScValTypeScvAddress, xdr.ScAddress{Type: xdr.ScAddressTypeScAddressTypeAccount, AccountId: &accountID})
	}
	return xdr.ScVal{}, fmt.Errorf("invalid stellar address %q", address)
}

func buildMetadataVal(req MintRequest) (xdr.ScVal, error) {
	vintage := req.VintageYear
	if vintage <= 0 {
		vintage = time.Now().UTC().Year()
	}
	geoHash := sha256.Sum256([]byte(req.ProjectID.String()))
	entries := xdr.ScMap{
		{Key: symbolVal("project_id"), Val: stringVal(req.ProjectID.String())},
		{Key: symbolVal("vintage_year"), Val: u64Val(uint64(vintage))},
		{Key: symbolVal("methodology_id"), Val: u32Val(uint32(req.MethodologyID))},
		{Key: symbolVal("geo_hash"), Val: bytes32Val(geoHash)},
		{Key: symbolVal("amount"), Val: u64Val(uint64(math.Ceil(req.Amount)))},
	}
	return xdr.NewScVal(xdr.ScValTypeScvMap, &entries)
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
