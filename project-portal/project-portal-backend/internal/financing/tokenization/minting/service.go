package minting

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	rpcclient "github.com/stellar/go/clients/rpcclient"
	"github.com/stellar/go/keypair"
	protocol "github.com/stellar/go/protocols/rpc"
	"github.com/stellar/go/strkey"
	"github.com/stellar/go/txnbuild"
	"github.com/stellar/go/xdr"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"
	"gorm.io/gorm"

	"carbon-scribe/project-portal/project-portal-backend/internal/observability"
)

// tracer names every span this package creates. Using the same
// instrumentation name as main.go's otelgin.Middleware (rather than this
// package's own import path) keeps every span in a request's trace grouped
// under one service identity in the trace backend.
var tracer = otel.Tracer(observability.DefaultServiceName)

const (
	// DefaultCarbonAssetContractID is the fallback Soroban contract ID for carbon assets.
	DefaultCarbonAssetContractID = "CAW7LUESK5RWH75W7IL64HYREFM5CPSFASBVVPVO2XOBC6AKHW4WJ6TM"

	// DefaultPollAttempts is the default number of attempts to poll for transaction confirmation.
	DefaultPollAttempts = 15

	// DefaultPollInterval is the duration between transaction status polling attempts.
	DefaultPollInterval = 2 * time.Second

	// MintTransactionTimeoutSeconds is the timeout in seconds for mint transactions.
	MintTransactionTimeoutSeconds = 300

	// MintingUseMockClientEnvVar explicitly opts into the in-memory mock
	// contract client. It is only ever honored outside production — see
	// NewContractClientFromEnv.
	MintingUseMockClientEnvVar = "MINTING_USE_MOCK_CLIENT"

	// mockTxHashPrefix marks a MintedToken row produced by the mock
	// contract client so it can never be mistaken for a real on-chain mint.
	mockTxHashPrefix = "MOCK_TX_HASH_"
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
	retry          RetryPolicy
	// network labels every MintedToken row this service creates (#794), so
	// it's clear later which ledger a given TxHash belongs to.
	network string
}

// retryPolicy returns the service's retry policy, normalised. A zero-value
// policy (a service built without one) falls back to the defaults rather than
// looping zero times.
func (s *service) retryPolicy() RetryPolicy {
	if s.retry.MaxAttempts < 1 {
		return DefaultRetryPolicy()
	}
	return s.retry
}

// RetryPolicyConfigurer is implemented by the minting service so callers can
// override the retry policy resolved from the environment at construction.
type RetryPolicyConfigurer interface {
	SetRetryPolicy(policy RetryPolicy)
}

// SetRetryPolicy overrides the retry policy, e.g. from application config.
func (s *service) SetRetryPolicy(policy RetryPolicy) {
	s.retry = policy.normalized()
}

type CarbonAssetContractClient interface {
	Mint(ctx context.Context, owner string, metadata CarbonAssetMetadata) (tokenID int, txHash string, err error)
}

// NewService constructs the minting service. client must be non-nil: callers
// are expected to resolve it explicitly via NewContractClientFromEnv (and
// handle the error it can return) or inject an explicit mock/fake for tests.
// NewService itself performs no env-based fallback, so production wiring can
// never silently degrade to the mock client.
//
// network (#794) is recorded on every MintedToken this service creates —
// pass the same network passphrase/label used to construct client, e.g.
// cfg.Soroban.NetworkPassphrase.
func NewService(db *gorm.DB, client CarbonAssetContractClient, capValidator *CapValidator, network string) Service {
	if client == nil {
		panic("minting: NewService requires a non-nil CarbonAssetContractClient; " +
			"construct one via NewContractClientFromEnv and handle its error, " +
			"or pass an explicit client for tests")
	}
	return &service{
		db:             db,
		contractClient: client,
		capValidator:   capValidator,
		retry:          RetryPolicyFromEnv(),
		network:        network,
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
		ID                   uuid.UUID
		Name                 string
		MethodologyTokenID   int
		VintageYear          int
		CarbonCredits        int
		StellarWalletAddress *string
	}
	if err := s.db.WithContext(ctx).Table("projects").Where("id = ?", projectID).First(&project).Error; err != nil {
		job.Status = "failed"
		job.Error = "project not found"
		s.db.WithContext(ctx).Save(job)
		return nil, fmt.Errorf("fetch project for minting: %w", err)
	}

	var walletAddress string
	if project.StellarWalletAddress != nil {
		walletAddress = *project.StellarWalletAddress
	}

	// Async minting or immediate? Requirement says "handle failures with retry logic".
	// For now we'll do it synchronously here, but in a real app this would be a background task.
	go s.processMintingJob(context.Background(), job, project.MethodologyTokenID, project.VintageYear, project.CarbonCredits, walletAddress)

	return job, nil
}

func (s *service) processMintingJob(ctx context.Context, job *MintingJob, methodologyID int, vintageYear int, projectCredits int, walletAddress string) {
	// Root span for the whole async minting job (issue #695). This runs in
	// its own goroutine detached from the originating HTTP request's
	// context (see MintProjectCredits — the job must outlive the request
	// that triggered it), so this is a new trace rather than a child of
	// that request's span; the Soroban RPC and DB child spans below are
	// what distinguish where this job's time actually goes.
	ctx, jobSpan := tracer.Start(ctx, "minting.process_job", oteltrace.WithAttributes(
		attribute.String("minting.job_id", job.ID.String()),
		attribute.String("minting.project_id", job.ProjectID.String()),
	))
	defer jobSpan.End()

	job.Status = "processing"
	s.db.WithContext(ctx).Save(job)

	// Mint to the project's own registered Stellar wallet (#793) — never a
	// single environment-configured fallback shared by every project.
	ownerAddress, ownerErr := resolveOwnerAddress(walletAddress)
	if ownerErr != nil {
		job.Status = "failed"
		job.Error = ownerErr.Error()
		s.db.WithContext(ctx).Save(job)
		jobSpan.RecordError(ownerErr)
		jobSpan.SetStatus(codes.Error, ownerErr.Error())
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

	// Retry logic. Delays grow exponentially with jitter, and a non-retryable
	// failure — a breached methodology cap, a contract rejection — fails the
	// job immediately rather than burning the remaining attempts on an
	// outcome that cannot change.
	policy := s.retryPolicy()
	var lastErr error
	for attempt := 1; attempt <= policy.MaxAttempts; attempt++ {
		var mintedTokenID int
		var mintedTxHash string
		mintFn := func(mintCtx context.Context) error {
			// Child span isolating Soroban RPC time (load account, simulate,
			// submit, poll for confirmation) from the DB time spent on
			// either side of it (issue #695).
			mintCtx, mintSpan := tracer.Start(mintCtx, "minting.soroban_rpc_call", oteltrace.WithAttributes(
				attribute.Int("minting.attempt", attempt),
			))
			defer mintSpan.End()

			tokenID, txHash, err := s.contractClient.Mint(mintCtx, ownerAddress, metadata)
			if err != nil {
				mintSpan.RecordError(err)
				mintSpan.SetStatus(codes.Error, err.Error())
				return err
			}
			mintSpan.SetAttributes(
				attribute.Int("minting.token_id", tokenID),
				attribute.String("minting.tx_hash", txHash),
			)
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
			// Child span isolating the DB writes that persist a successful
			// mint, distinct from the Soroban RPC time already captured
			// above (issue #695).
			dbCtx, dbSpan := tracer.Start(ctx, "minting.persist_result")

			job.Status = "completed"
			job.TxHash = mintedTxHash
			s.db.WithContext(dbCtx).Save(job)

			mintedToken := &MintedToken{
				JobID:         job.ID,
				TokenID:       mintedTokenID,
				TxHash:        mintedTxHash,
				IsMock:        isMockContractClient(s.contractClient),
				ProjectID:     job.ProjectID,
				VintageYear:   int(metadata.VintageYear),
				MethodologyID: int(metadata.MethodologyID),
				Network:       s.network,
				OwnerAddress:  ownerAddress,
			}
			s.db.WithContext(dbCtx).Create(mintedToken)
			dbSpan.End()
			jobSpan.SetStatus(codes.Ok, "")
			return
		}
		lastErr = err

		if !IsRetryable(err) {
			log.Printf("minting job %v: non-retryable failure on attempt %d/%d: %v",
				job.ID, attempt, policy.MaxAttempts, err)
			break
		}
		if attempt == policy.MaxAttempts {
			break
		}

		delay := policy.BackoffFor(attempt, nil)
		log.Printf("minting job %v: attempt %d/%d failed, retrying in %s: %v",
			job.ID, attempt, policy.MaxAttempts, delay, err)

		// Abandon the wait if the caller's context is already done, rather
		// than sleeping out the full backoff on a cancelled job.
		select {
		case <-ctx.Done():
			job.Status = "failed"
			job.Error = ctx.Err().Error()
			s.db.WithContext(ctx).Save(job)
			jobSpan.RecordError(ctx.Err())
			jobSpan.SetStatus(codes.Error, ctx.Err().Error())
			return
		case <-time.After(delay):
		}
	}

	job.Status = "failed"
	job.Error = lastErr.Error()
	s.db.WithContext(ctx).Save(job)
	jobSpan.RecordError(lastErr)
	jobSpan.SetStatus(codes.Error, lastErr.Error())
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

// NewContractClientFromEnv resolves the carbon asset contract client.
// isProduction gates which failure modes are tolerated:
//
//   - MINTING_USE_MOCK_CLIENT=true opts into the in-memory mock client, but
//     is only ever honored outside production; setting it in production is
//     an error, never a silent no-op.
//   - A missing or unparsable signing key is always an error — it never
//     silently downgrades to the mock client, in production or otherwise.
//     Outside production, use MINTING_USE_MOCK_CLIENT=true explicitly if a
//     real key isn't available.
//
// rpcURL and networkPassphrase (#794) come from internal/config — the
// single source for both, resolved once at startup — rather than this
// function reading STELLAR_RPC_URL/STELLAR_NETWORK_PASSPHRASE and applying
// its own testnet fallback. Callers must resolve them via config.Load (which
// already applies the testnet default outside production) before calling
// this.
func NewContractClientFromEnv(isProduction bool, rpcURL, networkPassphrase string) (CarbonAssetContractClient, error) {
	if useMock := strings.EqualFold(strings.TrimSpace(os.Getenv(MintingUseMockClientEnvVar)), "true"); useMock {
		if isProduction {
			return nil, fmt.Errorf(
				"%s=true is not permitted in production; configure CARBON_ASSET_AUTHORITY_SECRET_KEY or STELLAR_SECRET_KEY instead",
				MintingUseMockClientEnvVar,
			)
		}
		log.Printf("⚠️  %s=true: minting will use the mock contract client (non-production only)", MintingUseMockClientEnvVar)
		return &mockContractClient{}, nil
	}

	contractID := strings.TrimSpace(os.Getenv("CARBON_ASSET_CONTRACT_ID"))
	if contractID == "" {
		contractID = DefaultCarbonAssetContractID
	}

	seed := strings.TrimSpace(os.Getenv("CARBON_ASSET_AUTHORITY_SECRET_KEY"))
	if seed == "" {
		seed = strings.TrimSpace(os.Getenv("STELLAR_SECRET_KEY"))
	}
	if seed == "" {
		return nil, fmt.Errorf(
			"CARBON_ASSET_AUTHORITY_SECRET_KEY or STELLAR_SECRET_KEY must be set to a valid Stellar signing key; "+
				"set %s=true to use the mock client outside production",
			MintingUseMockClientEnvVar,
		)
	}

	authority, err := keypair.ParseFull(seed)
	if err != nil {
		return nil, fmt.Errorf(
			"CARBON_ASSET_AUTHORITY_SECRET_KEY/STELLAR_SECRET_KEY is not a valid Stellar signing key: %w", err,
		)
	}
	return &realContractClient{
		contractID:        contractID,
		rpcURL:            rpcURL,
		networkPassphrase: networkPassphrase,
		authority:         authority,
		rpc:               rpcclient.NewClient(rpcURL, newTracedHTTPClient()),
	}, nil
}

// ValidateNetworkConfig queries rpcURL's getNetwork endpoint and fails if
// the network it reports doesn't match expectedPassphrase (#794) — catching
// a mainnet RPC URL accidentally paired with the testnet passphrase (or
// vice versa) at startup, rather than at the first mint attempt.
func ValidateNetworkConfig(ctx context.Context, rpcURL, expectedPassphrase string) error {
	client := rpcclient.NewClient(rpcURL, newTracedHTTPClient())
	resp, err := client.GetNetwork(ctx)
	if err != nil {
		return fmt.Errorf("query getNetwork on %s: %w", rpcURL, err)
	}
	if resp.Passphrase != expectedPassphrase {
		return fmt.Errorf(
			"configured network passphrase %q does not match the passphrase reported by %s (%q)",
			expectedPassphrase, rpcURL, resp.Passphrase,
		)
	}
	return nil
}

// newTracedHTTPClient wraps the default transport with otelhttp so every
// outbound Soroban RPC call carries the active trace context in its headers
// and gets its own client-side span (issue #695) — this is the only
// outbound HTTP client this service builds from scratch rather than through
// a higher-level SDK. Extracted so a test can assert the transport is
// actually instrumented.
func newTracedHTTPClient() *http.Client {
	return &http.Client{Transport: otelhttp.NewTransport(http.DefaultTransport)}
}

// resolveOwnerAddress returns walletAddress (the project's own registered
// Stellar wallet) when set, falling back to resolveDefaultOwnerAddress's
// opt-in-only mechanism otherwise (#793). The returned error, when non-nil,
// is already phrased as "project has no registered Stellar wallet: ..." —
// the clear job.Error callers are expected to surface.
func resolveOwnerAddress(walletAddress string) (string, error) {
	if trimmed := strings.TrimSpace(walletAddress); trimmed != "" {
		return trimmed, nil
	}
	fallback, err := resolveDefaultOwnerAddress()
	if err != nil {
		return "", fmt.Errorf("project has no registered Stellar wallet: %w", err)
	}
	return fallback, nil
}

// MintingAllowDefaultOwnerEnvVar explicitly opts into resolveDefaultOwnerAddress
// as a fallback recipient when a project has no registered wallet. It is
// only ever honored outside production — see resolveDefaultOwnerAddress.
const MintingAllowDefaultOwnerEnvVar = "MINTING_ALLOW_DEFAULT_OWNER"

// resolveDefaultOwnerAddress is an explicit, opt-in-only fallback recipient
// for a project with no registered Stellar wallet (#793) — never used
// unless MINTING_ALLOW_DEFAULT_OWNER=true, and refused outright in
// production even then, since a shared fallback recipient defeats the
// purpose of minting to each project's own wallet. It deliberately never
// reads CARBON_ASSET_AUTHORITY_PUBLIC_KEY: that key signs mints, and using
// it as the recipient too would mix custody with signing authority.
func resolveDefaultOwnerAddress() (string, error) {
	if !strings.EqualFold(strings.TrimSpace(os.Getenv(MintingAllowDefaultOwnerEnvVar)), "true") {
		return "", fmt.Errorf(
			"no registered wallet, and the %s fallback is not enabled", MintingAllowDefaultOwnerEnvVar,
		)
	}
	if isProductionServerMode() {
		return "", fmt.Errorf(
			"%s is not permitted in production; every project must have its own registered Stellar wallet",
			MintingAllowDefaultOwnerEnvVar,
		)
	}

	var source string
	ownerAddress := os.Getenv("CARBON_ASSET_DEFAULT_PROJECT_OWNER")
	source = "CARBON_ASSET_DEFAULT_PROJECT_OWNER"
	if strings.TrimSpace(ownerAddress) == "" {
		ownerAddress = os.Getenv("STELLAR_PUBLIC_KEY")
		source = "STELLAR_PUBLIC_KEY"
	}
	ownerAddress = strings.TrimSpace(ownerAddress)
	if ownerAddress == "" {
		return "", fmt.Errorf(
			"%s=true but neither CARBON_ASSET_DEFAULT_PROJECT_OWNER nor STELLAR_PUBLIC_KEY is set",
			MintingAllowDefaultOwnerEnvVar,
		)
	}
	if _, err := keypair.ParseAddress(ownerAddress); err != nil {
		return "", fmt.Errorf("%s is not a valid Stellar account address: %w", source, err)
	}
	return ownerAddress, nil
}

// isProductionServerMode mirrors the isProduction signal main.go derives
// from cfg.Debug (SERVER_MODE/DEBUG) — resolveDefaultOwnerAddress has no
// Config in scope (it runs deep inside a detached goroutine), so it checks
// the same underlying environment variable directly.
func isProductionServerMode() bool {
	return !(strings.EqualFold(os.Getenv("SERVER_MODE"), "development") || os.Getenv("DEBUG") == "true")
}

func (c *realContractClient) Mint(ctx context.Context, owner string, metadata CarbonAssetMetadata) (int, string, error) {
	if strings.TrimSpace(owner) == "" {
		owner = c.authority.Address()
	}

	// 1. Load Admin Account
	account, err := c.rpc.LoadAccount(ctx, c.authority.Address())
	if err != nil {
		return 0, "", classifyMintError("load authority account", err, false)
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
		Preconditions:        txnbuild.Preconditions{TimeBounds: txnbuild.NewTimeout(MintTransactionTimeoutSeconds)},
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
		// Transport failure reaching the simulator - worth another attempt.
		return 0, "", classifyMintError("simulate mint transaction", err, false)
	}
	if simResp.Error != "" {
		// The contract rejected the invocation; an identical call is
		// rejected identically next time.
		return 0, "", Permanent(fmt.Errorf("mint simulation failed: %s", simResp.Error))
	}
	if simResp.RestorePreamble != nil {
		return 0, "", Permanent(errors.New("mint simulation indicates restore preamble is required"))
	}
	if len(simResp.Results) == 0 {
		return 0, "", Permanent(errors.New("mint simulation returned no results"))
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
		Preconditions:        txnbuild.Preconditions{TimeBounds: txnbuild.NewTimeout(MintTransactionTimeoutSeconds)},
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
		// Submission never reached the network - retry.
		return 0, "", classifyMintError("submit mint transaction", err, false)
	}
	if sendResp.ErrorResultXDR != "" {
		// The network rejected the envelope itself.
		return 0, "", Permanent(fmt.Errorf("mint submission failed with status %s", sendResp.Status))
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
	for attempt := 0; attempt < DefaultPollAttempts; attempt++ {
		response, err := c.rpc.GetTransaction(ctx, protocol.GetTransactionRequest{Hash: hash, Format: protocol.FormatBase64})
		if err != nil {
			return protocol.GetTransactionResponse{}, classifyMintError(
				fmt.Sprintf("poll mint transaction %s", hash), err, false)
		}
		switch response.Status {
		case protocol.TransactionStatusSuccess:
			return response, nil
		case protocol.TransactionStatusFailed:
			// Included in a ledger and failed; resubmitting the same operation
			// fails the same way.
			return protocol.GetTransactionResponse{}, Permanent(
				fmt.Errorf("mint transaction %s failed on-chain", hash))
		case protocol.TransactionStatusNotFound:
		default:
			if strings.EqualFold(response.Status, "SUCCESS") {
				return response, nil
			}
		}

		select {
		case <-ctx.Done():
			return protocol.GetTransactionResponse{}, ctx.Err()
		case <-time.After(DefaultPollInterval):
		}
	}
	// Unconfirmed within the polling window: the ledger may still catch up,
	// so another attempt is worthwhile.
	return protocol.GetTransactionResponse{}, Transient(
		fmt.Errorf("mint transaction %s was not confirmed before timeout", hash))
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

// Mock implementation for development. Only reachable via NewContractClientFromEnv
// when MintingUseMockClientEnvVar is explicitly set outside production.
type mockContractClient struct{}

func (m *mockContractClient) Mint(ctx context.Context, owner string, metadata CarbonAssetMetadata) (int, string, error) {
	time.Sleep(1 * time.Second)
	return int(time.Now().Unix() % 10000), mockTxHashPrefix + metadata.ProjectID, nil
}

// isMockClient marks mockContractClient so processMintingJob can flag any
// MintedToken row it produces, so mock data can never be mistaken for a
// real on-chain mint.
func (m *mockContractClient) isMockClient() bool { return true }

// mockClientMarker is implemented only by mockContractClient. It is checked
// via type assertion rather than widening the public CarbonAssetContractClient
// interface, so external test doubles that only implement Mint are unaffected.
type mockClientMarker interface {
	isMockClient() bool
}

// isMockContractClient reports whether client is the mock implementation,
// used to flag MintedToken.IsMock.
func isMockContractClient(client CarbonAssetContractClient) bool {
	marker, ok := client.(mockClientMarker)
	return ok && marker.isMockClient()
}
