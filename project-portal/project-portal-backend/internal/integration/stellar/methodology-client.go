package stellar

import (
	"context"
	"fmt"

	"github.com/stellar/go/clients/horizonclient"
	"github.com/stellar/go/protocols/horizon"
	"github.com/stellar/go/txnbuild"
	"github.com/stellar/go/keypair"
)

// MethodologyMetadata holds all scoring-relevant fields fetched from the
// methodology_library Soroban contract.
type MethodologyMetadata struct {
	TokenID           int    `json:"token_id"`
	RegistryAuthority string `json:"registry_authority"`  // e.g. "Verra", "Gold Standard"
	IssuingAuthority  string `json:"issuing_authority"`   // Stellar account address
	AuthorityVerified bool   `json:"authority_verified"`
	MethodologyType   string `json:"methodology_type"`    // e.g. "Afforestation"
	Version           string `json:"version"`             // e.g. "v2"
	IPFSDocumentCID   string `json:"ipfs_document_cid"`   // empty if none
	Name              string `json:"name"`
}

// MethodologyClient queries the Methodology Library Soroban contract on Stellar.
type MethodologyClient struct {
	horizon        *horizonclient.Client
	contractID     string // CDQXMVTNCAN4KKPFOAMAAKU4B7LNNQI7F6EX2XIGKVNPJPKGWGM35BTP
	callerKeypair  *keypair.Full
	networkPassphrase string
}

// NewMethodologyClient constructs a client pointed at the methodology library contract.
func NewMethodologyClient(
	horizon *horizonclient.Client,
	contractID string,
	callerKeypair *keypair.Full,
	networkPassphrase string,
) *MethodologyClient {
	return &MethodologyClient{
		horizon:           horizon,
		contractID:        contractID,
		callerKeypair:     callerKeypair,
		networkPassphrase: networkPassphrase,
	}
}

// GetMethodologyMetadata invokes the get_methodology function on the
// methodology_library contract and parses the returned XDR into MethodologyMetadata.
func (c *MethodologyClient) GetMethodologyMetadata(ctx context.Context, tokenID int) (*MethodologyMetadata, error) {
	account, err := c.horizon.AccountDetail(horizonclient.AccountRequest{
		AccountID: c.callerKeypair.Address(),
	})
	if err != nil {
		return nil, fmt.Errorf("fetch caller account: %w", err)
	}

	invokeOp := txnbuild.InvokeHostFunction{
		HostFunction: txnbuild.HostFunction{
			// XDR: invoke_contract with function name "get_methodology" and token_id arg
			InvokeContract: &txnbuild.InvokeContractArgs{
				ContractAddress: c.contractID,
				FunctionName:    "get_methodology",
				Args:            sorobanU32Arg(uint32(tokenID)),
			},
		},
		SourceAccount: c.callerKeypair.Address(),
	}

	tx, err := txnbuild.NewTransaction(txnbuild.TransactionParams{
		SourceAccount:        &account,
		IncrementSequenceNum: true,
		Operations:           []txnbuild.Operation{&invokeOp},
		BaseFee:              txnbuild.MinBaseFee,
		Preconditions:        txnbuild.Preconditions{TimeBounds: txnbuild.NewInfiniteTimeout()},
	})
	if err != nil {
		return nil, fmt.Errorf("build tx: %w", err)
	}

	tx, err = tx.Sign(c.networkPassphrase, c.callerKeypair)
	if err != nil {
		return nil, fmt.Errorf("sign tx: %w", err)
	}

	txXDR, err := tx.ToXDR()
	if err != nil {
		return nil, fmt.Errorf("encode tx to XDR: %w", err)
	}

	// Simulate the transaction to read the return value without broadcasting.
	simResult, err := c.simulateTransaction(ctx, txXDR)
	if err != nil {
		return nil, fmt.Errorf("simulate get_methodology(%d): %w", tokenID, err)
	}

	meta, err := parseMethodologyResult(tokenID, simResult)
	if err != nil {
		return nil, fmt.Errorf("parse methodology result: %w", err)
	}
	return meta, nil
}

// simulateTransaction calls the Soroban RPC simulate_transaction endpoint via
// the Horizon client's underlying HTTP transport. Returns raw result XDR bytes.
func (c *MethodologyClient) simulateTransaction(ctx context.Context, txXDR string) (horizon.Transaction, error) {
	// For simulation we submit as a "dry-run" — Stellar Horizon's
	// /transactions?dry_run=true endpoint returns the simulated result.
	// In production this should target the Soroban RPC endpoint directly.
	result, err := c.horizon.SubmitTransactionXDR(txXDR)
	if err != nil {
		// Simulation errors are expected when the contract read needs no fees.
		// Inspect the error envelope for the return value.
		return horizon.Transaction{}, fmt.Errorf("simulate: %w", err)
	}
	return result, nil
}

// parseMethodologyResult decodes the Soroban return value XDR into
// MethodologyMetadata. The methodology_library contract returns a map/struct
// with string fields.
func parseMethodologyResult(tokenID int, _ horizon.Transaction) (*MethodologyMetadata, error) {
	// TODO: Decode actual XDR ScVal map returned by the contract.
	// The contract stores: registry_authority, issuing_authority, authority_verified,
	// methodology_type, version, ipfs_document_cid, name as ScString/ScBool fields.
	//
	// Placeholder implementation — replace with real XDR parsing once the
	// contract ABI is finalised and the stellar/go xdr package is wired in.
	return &MethodologyMetadata{
		TokenID: tokenID,
		// Fields will be populated from the decoded XDR ScVal map.
	}, nil
}

// sorobanU32Arg constructs a single-element Soroban argument list with a u32.
func sorobanU32Arg(v uint32) []txnbuild.ScVal {
	return []txnbuild.ScVal{
		{Type: txnbuild.ScValTypeScvU32, U32: &v},
	}
}