package methodology

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	rpcclient "github.com/stellar/go/clients/rpcclient"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	protocol "github.com/stellar/go/protocols/rpc"
	"github.com/stellar/go/strkey"
	"github.com/stellar/go/txnbuild"
	"github.com/stellar/go/xdr"
)

const defaultSorobanRPCURL = "https://soroban-testnet.stellar.org:443"

// MethodologyContractClient abstracts calls into Methodology Library contract methods.
type MethodologyContractClient interface {
	MintMethodology(ctx context.Context, owner string, meta MethodologyMeta) (tokenID int, txHash string, err error)
	IsValidMethodology(ctx context.Context, tokenID int) (bool, error)
	ContractID() string
}

type realContractClient struct {
	contractID        string
	rpcURL            string
	networkPassphrase string
	authority         *keypair.Full
	rpc               *rpcclient.Client
	httpClient        *http.Client
	pollInterval      time.Duration
	pollAttempts      int
}

type mockContractClient struct {
	contractID string
	mu         sync.Mutex
	nextToken  int
	minted     map[int]MethodologyMeta
}

func NewContractClientFromEnv() MethodologyContractClient {
	contractID := strings.TrimSpace(os.Getenv("METHODOLOGY_LIBRARY_CONTRACT_ID"))
	if contractID == "" {
		contractID = DefaultMethodologyContractID
	}

	if client, err := newRealContractClientFromEnv(contractID); err == nil {
		return client
	}

	startToken := 1000
	if raw := os.Getenv("METHODOLOGY_MOCK_START_TOKEN"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			startToken = parsed
		}
	}

	return &mockContractClient{
		contractID: contractID,
		nextToken:  startToken,
		minted:     make(map[int]MethodologyMeta),
	}
}

func newRealContractClientFromEnv(contractID string) (*realContractClient, error) {
	if strings.EqualFold(strings.TrimSpace(os.Getenv("METHODOLOGY_USE_MOCK")), "true") {
		return nil, fmt.Errorf("mock methodology client explicitly enabled")
	}

	seed := strings.TrimSpace(os.Getenv("METHODOLOGY_AUTHORITY_SECRET_KEY"))
	if seed == "" {
		seed = strings.TrimSpace(os.Getenv("STELLAR_SECRET_KEY"))
	}
	if seed == "" {
		return nil, fmt.Errorf("missing methodology authority secret key")
	}

	authority, err := keypair.ParseFull(seed)
	if err != nil {
		return nil, fmt.Errorf("parse methodology authority secret key: %w", err)
	}

	rpcURL := strings.TrimSpace(os.Getenv("STELLAR_RPC_URL"))
	if rpcURL == "" {
		rpcURL = defaultSorobanRPCURL
	}

	networkPassphrase := strings.TrimSpace(os.Getenv("STELLAR_NETWORK_PASSPHRASE"))
	if networkPassphrase == "" {
		networkPassphrase = network.TestNetworkPassphrase
	}

	return &realContractClient{
		contractID:        contractID,
		rpcURL:            rpcURL,
		networkPassphrase: networkPassphrase,
		authority:         authority,
		rpc:               rpcclient.NewClient(rpcURL, http.DefaultClient),
		httpClient:        http.DefaultClient,
		pollInterval:      2 * time.Second,
		pollAttempts:      15,
	}, nil
}

func (c *realContractClient) ContractID() string {
	return c.contractID
}

func (c *realContractClient) MintMethodology(ctx context.Context, owner string, meta MethodologyMeta) (int, string, error) {
	if owner == "" {
		return 0, "", fmt.Errorf("owner address is required")
	}
	if meta.Name == "" || meta.Registry == "" || meta.IssuingAuthority == "" {
		return 0, "", fmt.Errorf("name, registry, and issuing_authority are required")
	}
	if meta.IssuingAuthority != c.authority.Address() {
		return 0, "", fmt.Errorf("issuing_authority must match configured methodology authority address")
	}

	authVal, err := scAddressVal(c.authority.Address())
	if err != nil {
		return 0, "", err
	}
	ownerVal, err := scAddressVal(owner)
	if err != nil {
		return 0, "", err
	}
	metaVal, err := buildMethodologyMetaVal(meta)
	if err != nil {
		return 0, "", err
	}

	txResp, err := c.submitContractTransaction(ctx, "mint_methodology", []xdr.ScVal{authVal, ownerVal, metaVal}, true)
	if err != nil {
		return 0, "", err
	}

	tokenID, err := extractMintTokenIDFromMeta(txResp.ResultMetaXDR)
	if err != nil {
		return 0, txResp.TransactionHash, err
	}
	return tokenID, txResp.TransactionHash, nil
}

func (c *realContractClient) IsValidMethodology(ctx context.Context, tokenID int) (bool, error) {
	if tokenID <= 0 {
		return false, nil
	}

	result, _, err := c.simulateContractCall(ctx, "is_valid_methodology", []xdr.ScVal{u32Val(uint32(tokenID))}, false)
	if err != nil {
		return false, err
	}
	if result.ReturnValueXDR == nil {
		return false, fmt.Errorf("is_valid_methodology simulation did not return a value")
	}

	var returnVal xdr.ScVal
	if err := xdr.SafeUnmarshalBase64(*result.ReturnValueXDR, &returnVal); err != nil {
		return false, fmt.Errorf("decode validation return value: %w", err)
	}
	if returnVal.Type != xdr.ScValTypeScvBool {
		return false, fmt.Errorf("unexpected validation return type: %s", returnVal.Type)
	}
	return returnVal.MustB(), nil
}

func (c *realContractClient) submitContractTransaction(ctx context.Context, functionName string, args []xdr.ScVal, requireAuth bool) (protocol.GetTransactionResponse, error) {
	account, err := c.rpc.LoadAccount(ctx, c.authority.Address())
	if err != nil {
		return protocol.GetTransactionResponse{}, fmt.Errorf("load methodology authority account: %w", err)
	}

	result, simulation, err := c.simulateContractCall(ctx, functionName, args, requireAuth)
	if err != nil {
		return protocol.GetTransactionResponse{}, err
	}
	if simulation.RestorePreamble != nil {
		return protocol.GetTransactionResponse{}, fmt.Errorf("contract call requires restore footprint before submission")
	}

	op, err := c.buildInvokeOperation(functionName, args)
	if err != nil {
		return protocol.GetTransactionResponse{}, err
	}
	if result.AuthXDR != nil {
		authEntries, err := decodeAuthEntries(*result.AuthXDR)
		if err != nil {
			return protocol.GetTransactionResponse{}, err
		}
		op.Auth = authEntries
	}

	var txData xdr.SorobanTransactionData
	if err := xdr.SafeUnmarshalBase64(simulation.TransactionDataXDR, &txData); err != nil {
		return protocol.GetTransactionResponse{}, fmt.Errorf("decode soroban transaction data: %w", err)
	}
	op.Ext = xdr.TransactionExt{V: 1, SorobanData: &txData}

	tx, err := txnbuild.NewTransaction(txnbuild.TransactionParams{
		SourceAccount:        account,
		IncrementSequenceNum: true,
		Operations:           []txnbuild.Operation{&op},
		BaseFee:              txnbuild.MinBaseFee + simulation.MinResourceFee,
		Preconditions:        txnbuild.Preconditions{TimeBounds: txnbuild.NewTimeout(300)},
	})
	if err != nil {
		return protocol.GetTransactionResponse{}, fmt.Errorf("build methodology transaction: %w", err)
	}

	signedTx, err := tx.Sign(c.networkPassphrase, c.authority)
	if err != nil {
		return protocol.GetTransactionResponse{}, fmt.Errorf("sign methodology transaction: %w", err)
	}
	envelope, err := signedTx.Base64()
	if err != nil {
		return protocol.GetTransactionResponse{}, fmt.Errorf("encode methodology transaction: %w", err)
	}

	sendResp, err := c.rpc.SendTransaction(ctx, protocol.SendTransactionRequest{Transaction: envelope, Format: protocol.FormatBase64})
	if err != nil {
		return protocol.GetTransactionResponse{}, fmt.Errorf("submit methodology transaction: %w", err)
	}
	if sendResp.ErrorResultXDR != "" {
		return protocol.GetTransactionResponse{}, fmt.Errorf("transaction submission failed with status %s", sendResp.Status)
	}

	return c.waitForTransaction(ctx, sendResp.Hash)
}

func (c *realContractClient) simulateContractCall(ctx context.Context, functionName string, args []xdr.ScVal, requireAuth bool) (protocol.SimulateHostFunctionResult, protocol.SimulateTransactionResponse, error) {
	account, err := c.rpc.LoadAccount(ctx, c.authority.Address())
	if err != nil {
		return protocol.SimulateHostFunctionResult{}, protocol.SimulateTransactionResponse{}, fmt.Errorf("load methodology authority account: %w", err)
	}

	op, err := c.buildInvokeOperation(functionName, args)
	if err != nil {
		return protocol.SimulateHostFunctionResult{}, protocol.SimulateTransactionResponse{}, err
	}

	tx, err := txnbuild.NewTransaction(txnbuild.TransactionParams{
		SourceAccount:        account,
		IncrementSequenceNum: true,
		Operations:           []txnbuild.Operation{&op},
		BaseFee:              txnbuild.MinBaseFee,
		Preconditions:        txnbuild.Preconditions{TimeBounds: txnbuild.NewTimeout(300)},
	})
	if err != nil {
		return protocol.SimulateHostFunctionResult{}, protocol.SimulateTransactionResponse{}, fmt.Errorf("build simulation transaction: %w", err)
	}
	encodedTx, err := tx.Base64()
	if err != nil {
		return protocol.SimulateHostFunctionResult{}, protocol.SimulateTransactionResponse{}, fmt.Errorf("encode simulation transaction: %w", err)
	}

	request := protocol.SimulateTransactionRequest{Transaction: encodedTx, Format: protocol.FormatBase64}
	if requireAuth {
		request.AuthMode = protocol.AuthModeRecord
	}

	simulation, err := c.rpc.SimulateTransaction(ctx, request)
	if err != nil {
		return protocol.SimulateHostFunctionResult{}, protocol.SimulateTransactionResponse{}, fmt.Errorf("simulate contract call %s: %w", functionName, err)
	}
	if simulation.Error != "" {
		return protocol.SimulateHostFunctionResult{}, protocol.SimulateTransactionResponse{}, fmt.Errorf("simulate contract call %s: %s", functionName, simulation.Error)
	}
	if len(simulation.Results) == 0 {
		return protocol.SimulateHostFunctionResult{}, protocol.SimulateTransactionResponse{}, fmt.Errorf("simulate contract call %s returned no results", functionName)
	}
	return simulation.Results[0], simulation, nil
}

func (c *realContractClient) buildInvokeOperation(functionName string, args []xdr.ScVal) (txnbuild.InvokeHostFunction, error) {
	contractAddress, err := contractScAddress(c.contractID)
	if err != nil {
		return txnbuild.InvokeHostFunction{}, err
	}
	return txnbuild.InvokeHostFunction{
		HostFunction: xdr.HostFunction{
			Type: xdr.HostFunctionTypeHostFunctionTypeInvokeContract,
			InvokeContract: &xdr.InvokeContractArgs{
				ContractAddress: contractAddress,
				FunctionName:    xdr.ScSymbol(functionName),
				Args:            args,
			},
		},
		SourceAccount: c.authority.Address(),
	}, nil
}

func (c *realContractClient) waitForTransaction(ctx context.Context, hash string) (protocol.GetTransactionResponse, error) {
	for attempt := 0; attempt < c.pollAttempts; attempt++ {
		response, err := c.rpc.GetTransaction(ctx, protocol.GetTransactionRequest{Hash: hash, Format: protocol.FormatBase64})
		if err != nil {
			return protocol.GetTransactionResponse{}, fmt.Errorf("poll methodology transaction %s: %w", hash, err)
		}
		switch response.Status {
		case protocol.TransactionStatusSuccess:
			return response, nil
		case protocol.TransactionStatusFailed:
			return protocol.GetTransactionResponse{}, fmt.Errorf("methodology transaction %s failed on-chain", hash)
		case protocol.TransactionStatusNotFound:
			// Wait for inclusion.
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
	return protocol.GetTransactionResponse{}, fmt.Errorf("methodology transaction %s was not confirmed before timeout", hash)
}

func contractScAddress(contractID string) (xdr.ScAddress, error) {
	decoded, err := strkey.Decode(strkey.VersionByteContract, contractID)
	if err != nil {
		return xdr.ScAddress{}, fmt.Errorf("decode contract id: %w", err)
	}
	var id xdr.ContractId
	copy(id[:], decoded)
	return xdr.ScAddress{Type: xdr.ScAddressTypeScAddressTypeContract, ContractId: &id}, nil
}

func scAddressVal(address string) (xdr.ScVal, error) {
	accountID, err := xdr.AddressToAccountId(address)
	if err == nil {
		return xdr.NewScVal(
			xdr.ScValTypeScvAddress,
			xdr.ScAddress{Type: xdr.ScAddressTypeScAddressTypeAccount, AccountId: &accountID},
		)
	}
	contractAddress, contractErr := contractScAddress(address)
	if contractErr == nil {
		return xdr.NewScVal(xdr.ScValTypeScvAddress, contractAddress)
	}
	return xdr.ScVal{}, fmt.Errorf("invalid stellar address %q", address)
}

func u32Val(value uint32) xdr.ScVal {
	scVal, _ := xdr.NewScVal(xdr.ScValTypeScvU32, xdr.Uint32(value))
	return scVal
}

func stringVal(value string) xdr.ScVal {
	scVal, _ := xdr.NewScVal(xdr.ScValTypeScvString, xdr.ScString(value))
	return scVal
}

func symbolVal(value string) xdr.ScVal {
	scVal, _ := xdr.NewScVal(xdr.ScValTypeScvSymbol, xdr.ScSymbol(value))
	return scVal
}

func voidVal() xdr.ScVal {
	scVal, _ := xdr.NewScVal(xdr.ScValTypeScvVoid, nil)
	return scVal
}

func buildMethodologyMetaVal(meta MethodologyMeta) (xdr.ScVal, error) {
	issuingAuthority, err := scAddressVal(meta.IssuingAuthority)
	if err != nil {
		return xdr.ScVal{}, err
	}

	ipfsValue := voidVal()
	if strings.TrimSpace(meta.IPFSCID) != "" {
		ipfsValue = stringVal(meta.IPFSCID)
	}

	entries := xdr.ScMap{
		{Key: symbolVal("ipfs_cid"), Val: ipfsValue},
		{Key: symbolVal("issuing_authority"), Val: issuingAuthority},
		{Key: symbolVal("name"), Val: stringVal(meta.Name)},
		{Key: symbolVal("registry"), Val: stringVal(meta.Registry)},
		{Key: symbolVal("registry_link"), Val: stringVal(meta.RegistryLink)},
		{Key: symbolVal("version"), Val: stringVal(meta.Version)},
	}
	return xdr.NewScVal(xdr.ScValTypeScvMap, &entries)
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
	return extractMintTokenIDFromEvents(events)
}

func extractMintTokenIDFromEvents(events []xdr.ContractEvent) (int, error) {
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

func (c *mockContractClient) ContractID() string {
	return c.contractID
}

func (c *mockContractClient) MintMethodology(ctx context.Context, owner string, meta MethodologyMeta) (int, string, error) {
	if owner == "" {
		return 0, "", fmt.Errorf("owner address is required")
	}
	if meta.Name == "" || meta.Registry == "" || meta.IssuingAuthority == "" {
		return 0, "", fmt.Errorf("name, registry, and issuing_authority are required")
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	tokenID := c.nextToken
	c.nextToken++
	c.minted[tokenID] = meta

	hashInput := fmt.Sprintf("%s:%s:%d:%s", c.contractID, owner, tokenID, meta.Name)
	txHashSum := sha256.Sum256([]byte(hashInput))
	return tokenID, hex.EncodeToString(txHashSum[:]), nil
}

func (c *mockContractClient) IsValidMethodology(ctx context.Context, tokenID int) (bool, error) {
	if tokenID <= 0 {
		return false, nil
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	_, ok := c.minted[tokenID]
	return ok, nil
}
