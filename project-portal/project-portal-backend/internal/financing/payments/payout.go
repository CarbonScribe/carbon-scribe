package payments

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/auth"
	"carbon-scribe/project-portal/project-portal-backend/internal/financing/tokenization"
	"carbon-scribe/project-portal/project-portal-backend/internal/financing/tokenization/minting"

	"github.com/google/uuid"
	"github.com/stellar/go/clients/horizonclient"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	"github.com/stellar/go/txnbuild"
)

const (
	// defaultPayoutHorizonURL is used when STELLAR_HORIZON_URL is unset.
	defaultPayoutHorizonURL = "https://horizon-testnet.stellar.org"
	// PayoutTransactionTimeoutSeconds bounds how long a submitted payout
	// transaction remains valid before Horizon rejects it as expired.
	PayoutTransactionTimeoutSeconds = 300
)

// Errors returned by payout execution. Handlers/tests use errors.Is against
// these to distinguish specific, actionable per-beneficiary failures from
// generic ones (#569).
var (
	// ErrNoVerifiedWallet means the beneficiary has no wallet on file that is
	// both verified and usable as a payout destination.
	ErrNoVerifiedWallet = errors.New("beneficiary has no verified Stellar wallet")
	// ErrTrustlineMissing means the beneficiary's resolved wallet has not
	// established a trustline for the payout asset.
	ErrTrustlineMissing = errors.New("beneficiary account has no trustline for the payout asset")
	// ErrAssetIssuerNotConfigured means PAYOUT_ASSET_ISSUERS has no entry for
	// the distribution's asset code, so no payment can be built at all.
	ErrAssetIssuerNotConfigured = errors.New("payout asset issuer not configured")
)

// PayoutAssetIssuers maps an asset code (e.g. "USDC") to the Stellar account
// that issues it, populated from PAYOUT_ASSET_ISSUERS in
// NewPayoutExecutorFromEnv. A distribution's currency is normalized to an
// asset code via NormalizeAssetCode before this lookup.
var PayoutAssetIssuers = map[string]string{}

// WalletResolver looks up the wallets on file for a user. Satisfied by
// *auth.Repository; defined narrowly here so payout execution can be tested
// without a real database.
type WalletResolver interface {
	GetUserWallets(userID string) ([]auth.UserWallet, error)
}

// ResolveVerifiedWallet returns the Stellar address a payout to userID
// should be sent to: the primary verified wallet if one exists, otherwise
// the first verified wallet found. Returns ErrNoVerifiedWallet if the user
// has no verified wallet at all — an unverified address is never used for a
// payout, regardless of how it's marked.
func ResolveVerifiedWallet(resolver WalletResolver, userID uuid.UUID) (string, error) {
	wallets, err := resolver.GetUserWallets(userID.String())
	if err != nil {
		return "", fmt.Errorf("look up wallets for user %s: %w", userID, err)
	}

	fallback := ""
	for _, w := range wallets {
		if !w.Verified || strings.TrimSpace(w.WalletAddress) == "" {
			continue
		}
		if w.IsPrimary {
			return w.WalletAddress, nil
		}
		if fallback == "" {
			fallback = w.WalletAddress
		}
	}
	if fallback != "" {
		return fallback, nil
	}
	return "", fmt.Errorf("%w: user %s", ErrNoVerifiedWallet, userID)
}

// PayoutExecutor submits the real Stellar payments for a computed
// DistributionOutput.
//
// Execute is safe to call again on the same *DistributionOutput after a
// partial failure or a crash between attempts: any beneficiary already
// BeneficiaryPayoutSucceeded is skipped rather than re-submitted, so a retry
// can never double-pay (#569). Callers are responsible for persisting
// DistributionOutput (e.g. via Repository.UpdateRevenueDistribution) between
// attempts so that status survives a process restart.
type PayoutExecutor interface {
	Execute(ctx context.Context, distributionID string, assetCode string, output *DistributionOutput) error
}

// NewPayoutExecutorFromEnv returns a RealPayoutExecutor configured from
// environment variables, or a MockPayoutExecutor if PAYOUT_USE_MOCK is set
// or the treasury key is missing — mirroring tokenization.NewClientFromEnv's
// graceful degradation so local/dev environments work without live Stellar
// credentials.
func NewPayoutExecutorFromEnv(wallets WalletResolver) PayoutExecutor {
	if strings.EqualFold(strings.TrimSpace(os.Getenv("PAYOUT_USE_MOCK")), "true") {
		return &MockPayoutExecutor{wallets: wallets}
	}
	executor, err := newRealPayoutExecutorFromEnv(wallets)
	if err != nil {
		return &MockPayoutExecutor{wallets: wallets}
	}
	return executor
}

func newRealPayoutExecutorFromEnv(wallets WalletResolver) (*RealPayoutExecutor, error) {
	seed := strings.TrimSpace(os.Getenv("PAYOUT_TREASURY_SECRET_KEY"))
	if seed == "" {
		seed = strings.TrimSpace(os.Getenv("STELLAR_SECRET_KEY"))
	}
	if seed == "" {
		return nil, fmt.Errorf("missing PAYOUT_TREASURY_SECRET_KEY or STELLAR_SECRET_KEY")
	}
	treasury, err := keypair.ParseFull(seed)
	if err != nil {
		return nil, fmt.Errorf("parse treasury key: %w", err)
	}

	networkPassphrase := strings.TrimSpace(os.Getenv("STELLAR_NETWORK_PASSPHRASE"))
	if networkPassphrase == "" {
		networkPassphrase = network.TestNetworkPassphrase
	}

	horizonURL := strings.TrimSpace(os.Getenv("STELLAR_HORIZON_URL"))
	if horizonURL == "" {
		horizonURL = defaultPayoutHorizonURL
	}

	loadPayoutAssetIssuersFromEnv()

	return &RealPayoutExecutor{
		horizon:           &horizonclient.Client{HorizonURL: horizonURL, HTTP: http.DefaultClient},
		networkPassphrase: networkPassphrase,
		treasury:          treasury,
		wallets:           wallets,
		retryPolicy:       minting.RetryPolicyFromEnv(),
	}, nil
}

// loadPayoutAssetIssuersFromEnv populates PayoutAssetIssuers from
// PAYOUT_ASSET_ISSUERS, a comma-separated list of CODE:ISSUER pairs, e.g.
// "USDC:GISSUER...,CRB2025:GISSUER2...".
func loadPayoutAssetIssuersFromEnv() {
	raw := strings.TrimSpace(os.Getenv("PAYOUT_ASSET_ISSUERS"))
	if raw == "" {
		return
	}
	for pair := range strings.SplitSeq(raw, ",") {
		parts := strings.SplitN(strings.TrimSpace(pair), ":", 2)
		if len(parts) != 2 {
			continue
		}
		code := strings.ToUpper(strings.TrimSpace(parts[0]))
		issuer := strings.TrimSpace(parts[1])
		if code == "" || issuer == "" {
			continue
		}
		PayoutAssetIssuers[code] = issuer
	}
}

// updateDistributionStatus summarizes per-beneficiary outcomes onto the
// distribution as a whole, shared by both executor implementations.
func updateDistributionStatus(output *DistributionOutput) {
	succeeded, attempted := 0, 0
	for _, b := range output.Beneficiaries {
		switch b.Status {
		case BeneficiaryPayoutSucceeded:
			succeeded++
			attempted++
		case BeneficiaryPayoutFailed:
			attempted++
		}
	}
	switch {
	case attempted == 0:
		output.Status = DistributionStatusPending
	case succeeded == attempted && succeeded == len(output.Beneficiaries):
		output.Status = DistributionStatusCompleted
	case succeeded == 0:
		output.Status = DistributionStatusFailed
	default:
		output.Status = DistributionStatusPartial
	}
}

// payoutMemo derives a deterministic 32-byte memo tying an on-chain payment
// back to its distribution and beneficiary, for reconciliation. It plays no
// role in idempotency — the persisted BeneficiaryAmount.Status is the
// authority for that — but makes a payout traceable from a block explorer.
func payoutMemo(distributionID string, userID uuid.UUID) txnbuild.MemoHash {
	return txnbuild.MemoHash(sha256.Sum256([]byte(distributionID + ":" + userID.String())))
}

// ============================================================================
// Mock executor
// ============================================================================

// MockPayoutExecutor resolves real wallets but never talks to Stellar,
// for local development and tests. An address beginning with "GNOTRUST"
// simulates a beneficiary whose wallet has no trustline for the payout
// asset, mirroring the convention used by tokenization's mock client.
type MockPayoutExecutor struct {
	wallets WalletResolver
}

func NewMockPayoutExecutor(wallets WalletResolver) *MockPayoutExecutor {
	return &MockPayoutExecutor{wallets: wallets}
}

func (e *MockPayoutExecutor) Execute(_ context.Context, distributionID string, assetCode string, output *DistributionOutput) error {
	for i := range output.Beneficiaries {
		b := &output.Beneficiaries[i]
		if b.Status == BeneficiaryPayoutSucceeded {
			continue // already paid; retrying must not double-pay (#569)
		}
		if b.PayoutAmount <= 0 {
			b.Status = BeneficiaryPayoutSkipped
			slog.Info("payout skipped: zero amount after tax withholding",
				"distribution_id", distributionID, "beneficiary_id", b.UserID.String())
			continue
		}

		address, err := ResolveVerifiedWallet(e.wallets, b.UserID)
		if err != nil {
			b.Status = BeneficiaryPayoutFailed
			b.FailureReason = err.Error()
			slog.Warn("payout failed: wallet resolution",
				"distribution_id", distributionID, "beneficiary_id", b.UserID.String(), "error", err)
			continue
		}
		b.StellarAddress = address

		if strings.HasPrefix(address, "GNOTRUST") {
			b.Status = BeneficiaryPayoutFailed
			b.FailureReason = ErrTrustlineMissing.Error()
			slog.Warn("payout failed: missing trustline",
				"distribution_id", distributionID, "beneficiary_id", b.UserID.String(), "recipient", address)
			continue
		}

		b.Status = BeneficiaryPayoutSucceeded
		b.TransactionHash = strings.ReplaceAll(uuid.NewString(), "-", "")
		slog.Info("payout succeeded",
			"distribution_id", distributionID, "beneficiary_id", b.UserID.String(),
			"amount", b.PayoutAmount, "asset_code", assetCode, "tx_hash", b.TransactionHash)
	}

	updateDistributionStatus(output)
	return nil
}

// ============================================================================
// Real executor
// ============================================================================

type RealPayoutExecutor struct {
	horizon           horizonclient.ClientInterface
	networkPassphrase string
	treasury          *keypair.Full
	wallets           WalletResolver
	retryPolicy       minting.RetryPolicy
}

func (e *RealPayoutExecutor) Execute(ctx context.Context, distributionID string, assetCode string, output *DistributionOutput) error {
	issuer, ok := PayoutAssetIssuers[strings.ToUpper(strings.TrimSpace(assetCode))]
	if !ok || issuer == "" {
		return fmt.Errorf("%w: %s", ErrAssetIssuerNotConfigured, assetCode)
	}

	for i := range output.Beneficiaries {
		b := &output.Beneficiaries[i]
		if b.Status == BeneficiaryPayoutSucceeded {
			continue // already paid; retrying must not double-pay (#569)
		}
		e.executeBeneficiary(ctx, distributionID, assetCode, issuer, b)
	}

	updateDistributionStatus(output)
	return nil
}

func (e *RealPayoutExecutor) executeBeneficiary(
	ctx context.Context,
	distributionID, assetCode, issuer string,
	b *BeneficiaryAmount,
) {
	logAttrs := []any{
		"distribution_id", distributionID,
		"beneficiary_id", b.UserID.String(),
		"asset_code", assetCode,
		"amount", b.PayoutAmount,
	}

	if b.PayoutAmount <= 0 {
		b.Status = BeneficiaryPayoutSkipped
		slog.Info("payout skipped: zero amount after tax withholding", logAttrs...)
		return
	}

	address, err := ResolveVerifiedWallet(e.wallets, b.UserID)
	if err != nil {
		b.Status = BeneficiaryPayoutFailed
		b.FailureReason = err.Error()
		slog.Warn("payout failed: wallet resolution", append(logAttrs, "error", err)...)
		return
	}
	b.StellarAddress = address
	logAttrs = append(logAttrs, "recipient", address)

	hasTrustline, err := e.hasTrustline(address, assetCode, issuer)
	if err != nil {
		b.Status = BeneficiaryPayoutFailed
		b.FailureReason = fmt.Sprintf("trustline check failed: %v", err)
		slog.Warn("payout failed: trustline check error", append(logAttrs, "error", err)...)
		return
	}
	if !hasTrustline {
		b.Status = BeneficiaryPayoutFailed
		b.FailureReason = ErrTrustlineMissing.Error()
		slog.Warn("payout failed: missing trustline", logAttrs...)
		return
	}

	memo := payoutMemo(distributionID, b.UserID)
	txHash, err := e.submitPaymentWithRetry(ctx, address, assetCode, issuer, b.PayoutAmount, memo)
	if err != nil {
		b.Status = BeneficiaryPayoutFailed
		b.FailureReason = err.Error()
		slog.Warn("payout failed: submission error", append(logAttrs, "error", err)...)
		return
	}

	b.Status = BeneficiaryPayoutSucceeded
	b.TransactionHash = txHash
	slog.Info("payout succeeded", append(logAttrs, "tx_hash", txHash)...)
}

func (e *RealPayoutExecutor) hasTrustline(address, assetCode, issuer string) (bool, error) {
	account, err := e.horizon.AccountDetail(horizonclient.AccountRequest{AccountID: address})
	if err != nil {
		if horizonclient.IsNotFoundError(err) {
			return false, nil
		}
		return false, fmt.Errorf("load recipient account: %w", err)
	}
	for _, balance := range account.Balances {
		if balance.Asset.Code == assetCode && balance.Asset.Issuer == issuer {
			return true, nil
		}
	}
	return false, nil
}

// submitPaymentWithRetry retries a payment submission on transient failures
// using an exponential backoff, mirroring the retry discipline
// stellar_client.go applies to waitForTransaction. Resubmitting the exact
// same signed envelope after a timeout is safe: Stellar's sequence-number
// replay protection means it can succeed at most once.
func (e *RealPayoutExecutor) submitPaymentWithRetry(
	ctx context.Context,
	destination, assetCode, issuer string,
	amount float64,
	memo txnbuild.MemoHash,
) (string, error) {
	policy := e.retryPolicy
	var lastErr error

	for attempt := 1; attempt <= policy.MaxAttempts; attempt++ {
		hash, err := e.submitPayment(destination, assetCode, issuer, amount, memo)
		if err == nil {
			return hash, nil
		}
		lastErr = err

		if !minting.IsRetryable(err) || attempt == policy.MaxAttempts {
			break
		}

		delay := policy.BackoffFor(attempt, nil)
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-time.After(delay):
		}
	}

	return "", lastErr
}

func (e *RealPayoutExecutor) submitPayment(
	destination, assetCode, issuer string,
	amount float64,
	memo txnbuild.MemoHash,
) (string, error) {
	sourceAccount, err := e.horizon.AccountDetail(horizonclient.AccountRequest{AccountID: e.treasury.Address()})
	if err != nil {
		return "", minting.Transient(fmt.Errorf("load treasury account: %w", err))
	}

	paymentOp := &txnbuild.Payment{
		Destination: destination,
		Amount:      strconv.FormatFloat(amount, 'f', 7, 64),
		Asset:       txnbuild.CreditAsset{Code: assetCode, Issuer: issuer},
	}

	tx, err := txnbuild.NewTransaction(txnbuild.TransactionParams{
		SourceAccount:        &sourceAccount,
		IncrementSequenceNum: true,
		Operations:           []txnbuild.Operation{paymentOp},
		BaseFee:              txnbuild.MinBaseFee,
		Preconditions:        txnbuild.Preconditions{TimeBounds: txnbuild.NewTimeout(PayoutTransactionTimeoutSeconds)},
		Memo:                 memo,
	})
	if err != nil {
		return "", minting.Permanent(fmt.Errorf("build payment transaction: %w", err))
	}

	signedTx, err := tx.Sign(e.networkPassphrase, e.treasury)
	if err != nil {
		return "", minting.Permanent(fmt.Errorf("sign payment transaction: %w", err))
	}

	resp, err := e.horizon.SubmitTransaction(signedTx)
	if err != nil {
		return "", classifySubmitError(err)
	}

	return resp.Hash, nil
}

// classifySubmitError distinguishes transient Horizon/network failures
// (worth retrying) from permanent ones (a retry would fail identically).
func classifySubmitError(err error) error {
	if tokenization.IsNoTrustlineHorizonError(err) {
		return minting.Permanent(fmt.Errorf("%w: %v", ErrTrustlineMissing, err))
	}

	hErr := horizonclient.GetError(err)
	if hErr == nil {
		// Not a structured Horizon API error — a network/transport failure,
		// which is exactly the class of fault worth retrying.
		return minting.Transient(err)
	}

	status := hErr.Problem.Status
	if status == http.StatusTooManyRequests || status >= http.StatusInternalServerError {
		return minting.Transient(err)
	}
	return minting.Permanent(err)
}
