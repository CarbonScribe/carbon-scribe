package tokenization

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"

	"github.com/google/uuid"
	"github.com/stellar/go/clients/horizonclient"
	hProtocol "github.com/stellar/go/protocols/horizon"
	"github.com/stellar/go/txnbuild"
)

const (
	// defaultHorizonURL is the default Horizon endpoint for Stellar testnet,
	// used to check account balances/trustlines and build ChangeTrust
	// transactions.
	defaultHorizonURL = "https://horizon-testnet.stellar.org"

	// TrustlineTransactionTimeoutSeconds is the timeout in seconds for
	// unsigned ChangeTrust/SetTrustLineFlags transactions.
	TrustlineTransactionTimeoutSeconds = 300
)

// Errors returned by the trustline flow. Handlers use errors.Is against
// these to distinguish specific, actionable failures from generic ones.
var (
	// ErrBuyerAccountNotFound indicates the buyer's Stellar account does not
	// exist or is not yet funded, so a trustline transaction cannot be
	// offered for signing.
	ErrBuyerAccountNotFound = errors.New("buyer account not found or not funded")

	// ErrTrustlineMissing indicates a transfer was blocked because the
	// destination account has no trustline for the asset being sent.
	ErrTrustlineMissing = errors.New("recipient has no trustline for asset")
)

// DefaultTrustlineLimits configures the default ChangeTrust limit applied
// per supported asset code when a caller does not specify one explicitly.
// Populated from CARBON_ASSET_TRUSTLINE_LIMITS in newRealClientFromEnv;
// falls back to txnbuild.MaxTrustlineLimit for any code not listed here.
var DefaultTrustlineLimits = map[string]string{}

// AssetsRequiringAuthorization lists asset codes whose issuer has set
// AUTH_REQUIRED_FLAG, meaning the issuer must explicitly authorize a
// buyer's trustline (via SetTrustLineFlags) before it can hold a balance.
// Populated from CARBON_ASSET_AUTH_REQUIRED_CODES in newRealClientFromEnv.
var AssetsRequiringAuthorization = map[string]bool{}

// TrustlineRequest describes a buyer's request to establish a trustline for
// a given asset, ahead of a carbon-credit or stablecoin transfer.
type TrustlineRequest struct {
	BuyerAddress string
	AssetCode    string
	AssetIssuer  string
	// Limit is optional; when empty, defaultTrustlineLimit(AssetCode) is used.
	Limit string
}

// TrustlineResponse carries the unsigned ChangeTrust transaction XDR for the
// buyer's wallet to sign, along with the asset/limit it was built for.
type TrustlineResponse struct {
	TransactionXDR string
	AssetCode      string
	AssetIssuer    string
	Limit          string
}

func defaultTrustlineLimit(assetCode string) string {
	if limit, ok := DefaultTrustlineLimits[strings.ToUpper(strings.TrimSpace(assetCode))]; ok && limit != "" {
		return limit
	}
	return txnbuild.MaxTrustlineLimit
}

// hasTrustlineInBalances reports whether balances contains a line for the
// given asset code/issuer, regardless of its current balance amount (a
// trustline with a zero balance still counts as established).
func hasTrustlineInBalances(balances []hProtocol.Balance, code, issuer string) bool {
	for _, b := range balances {
		if b.Asset.Code == code && b.Asset.Issuer == issuer {
			return true
		}
	}
	return false
}

// IsNoTrustlineHorizonError reports whether err represents a Horizon
// op_no_trust failure, i.e. a submitted transaction was rejected because
// the destination account has no trustline for the operation's asset. This
// lets callers distinguish a missing-trustline failure from other transfer
// failures in logs and API responses.
func IsNoTrustlineHorizonError(err error) bool {
	hErr := horizonclient.GetError(err)
	if hErr == nil {
		return false
	}
	codes, resultErr := hErr.ResultCodes()
	if resultErr != nil {
		return false
	}
	if codes.TransactionCode == "op_no_trust" {
		return true
	}
	return slices.Contains(codes.OperationCodes, "op_no_trust")
}

// mockUnfundedAddressPrefix marks mock buyer addresses treated as unfunded,
// so tests/local dev can exercise the ErrBuyerAccountNotFound path without a
// real Horizon instance.
const mockUnfundedAddressPrefix = "GUNFUNDED"

func (c *MockStellarClient) BuildTrustlineTransaction(ctx context.Context, req TrustlineRequest) (*TrustlineResponse, error) {
	buyer := strings.TrimSpace(req.BuyerAddress)
	if buyer == "" {
		return nil, fmt.Errorf("buyer address is required")
	}
	if strings.HasPrefix(buyer, mockUnfundedAddressPrefix) {
		return nil, fmt.Errorf("%w: %s", ErrBuyerAccountNotFound, buyer)
	}
	assetCode := strings.TrimSpace(req.AssetCode)
	if assetCode == "" {
		return nil, fmt.Errorf("asset code is required")
	}
	issuer := strings.TrimSpace(req.AssetIssuer)
	if issuer == "" {
		return nil, fmt.Errorf("asset issuer is required")
	}
	limit := strings.TrimSpace(req.Limit)
	if limit == "" {
		limit = defaultTrustlineLimit(assetCode)
	}
	return &TrustlineResponse{
		TransactionXDR: fmt.Sprintf("MOCK_CHANGE_TRUST_XDR_%s_%s", assetCode, strings.ReplaceAll(uuid.NewString(), "-", "")),
		AssetCode:      assetCode,
		AssetIssuer:    issuer,
		Limit:          limit,
	}, nil
}

func (c *MockStellarClient) HasTrustline(ctx context.Context, accountAddress, assetCode, assetIssuer string) (bool, error) {
	if strings.TrimSpace(accountAddress) == "" {
		return false, fmt.Errorf("account address is required")
	}
	// The mock client assumes a trustline is present unless the caller
	// opted into simulating removal via this address prefix, so local/dev
	// mint flows are not blocked by default.
	return !strings.HasPrefix(strings.TrimSpace(accountAddress), "GNOTRUST"), nil
}

func (c *MockStellarClient) AuthorizeTrustlineIfRequired(ctx context.Context, buyerAddress, assetCode string) error {
	return nil
}

func (c *RealStellarClient) BuildTrustlineTransaction(ctx context.Context, req TrustlineRequest) (*TrustlineResponse, error) {
	buyer := strings.TrimSpace(req.BuyerAddress)
	if buyer == "" {
		return nil, fmt.Errorf("buyer address is required")
	}
	assetCode := strings.TrimSpace(req.AssetCode)
	if assetCode == "" {
		return nil, fmt.Errorf("asset code is required")
	}
	issuer := strings.TrimSpace(req.AssetIssuer)
	if issuer == "" {
		return nil, fmt.Errorf("asset issuer is required")
	}

	account, err := c.horizon.AccountDetail(horizonclient.AccountRequest{AccountID: buyer})
	if err != nil {
		if horizonclient.IsNotFoundError(err) {
			return nil, fmt.Errorf("%w: %s", ErrBuyerAccountNotFound, buyer)
		}
		return nil, fmt.Errorf("load buyer account: %w", err)
	}

	limit := strings.TrimSpace(req.Limit)
	if limit == "" {
		limit = defaultTrustlineLimit(assetCode)
	}

	changeTrustAsset, err := txnbuild.CreditAsset{Code: assetCode, Issuer: issuer}.ToChangeTrustAsset()
	if err != nil {
		return nil, fmt.Errorf("build trustline asset: %w", err)
	}

	op := &txnbuild.ChangeTrust{
		Line:          changeTrustAsset,
		Limit:         limit,
		SourceAccount: buyer,
	}

	tx, err := txnbuild.NewTransaction(txnbuild.TransactionParams{
		SourceAccount:        &account,
		IncrementSequenceNum: true,
		Operations:           []txnbuild.Operation{op},
		BaseFee:              txnbuild.MinBaseFee,
		Preconditions:        txnbuild.Preconditions{TimeBounds: txnbuild.NewTimeout(TrustlineTransactionTimeoutSeconds)},
	})
	if err != nil {
		return nil, fmt.Errorf("build trustline transaction: %w", err)
	}

	encoded, err := tx.Base64()
	if err != nil {
		return nil, fmt.Errorf("encode trustline transaction: %w", err)
	}

	return &TrustlineResponse{
		TransactionXDR: encoded,
		AssetCode:      assetCode,
		AssetIssuer:    issuer,
		Limit:          limit,
	}, nil
}

func (c *RealStellarClient) HasTrustline(ctx context.Context, accountAddress, assetCode, assetIssuer string) (bool, error) {
	address := strings.TrimSpace(accountAddress)
	if address == "" {
		return false, fmt.Errorf("account address is required")
	}
	account, err := c.horizon.AccountDetail(horizonclient.AccountRequest{AccountID: address})
	if err != nil {
		if horizonclient.IsNotFoundError(err) {
			return false, fmt.Errorf("%w: %s", ErrBuyerAccountNotFound, address)
		}
		return false, fmt.Errorf("load account: %w", err)
	}
	return hasTrustlineInBalances(account.Balances, strings.TrimSpace(assetCode), strings.TrimSpace(assetIssuer)), nil
}

// AuthorizeTrustlineIfRequired issues a SetTrustLineFlags transaction
// authorizing buyer's trustline when assetCode is configured in
// AssetsRequiringAuthorization (i.e. its issuer has AUTH_REQUIRED_FLAG
// set). It is a no-op for assets that do not require issuer authorization.
func (c *RealStellarClient) AuthorizeTrustlineIfRequired(ctx context.Context, buyerAddress, assetCode string) error {
	code := strings.ToUpper(strings.TrimSpace(assetCode))
	if !AssetsRequiringAuthorization[code] {
		return nil
	}
	buyer := strings.TrimSpace(buyerAddress)
	if buyer == "" {
		return fmt.Errorf("buyer address is required")
	}

	issuerAccount, err := c.horizon.AccountDetail(horizonclient.AccountRequest{AccountID: c.authority.Address()})
	if err != nil {
		return fmt.Errorf("load issuer account: %w", err)
	}

	op := &txnbuild.SetTrustLineFlags{
		Trustor:       buyer,
		Asset:         txnbuild.CreditAsset{Code: code, Issuer: c.authority.Address()},
		SetFlags:      []txnbuild.TrustLineFlag{txnbuild.TrustLineAuthorized},
		SourceAccount: c.authority.Address(),
	}

	tx, err := txnbuild.NewTransaction(txnbuild.TransactionParams{
		SourceAccount:        &issuerAccount,
		IncrementSequenceNum: true,
		Operations:           []txnbuild.Operation{op},
		BaseFee:              txnbuild.MinBaseFee,
		Preconditions:        txnbuild.Preconditions{TimeBounds: txnbuild.NewTimeout(TrustlineTransactionTimeoutSeconds)},
	})
	if err != nil {
		return fmt.Errorf("build authorize trustline transaction: %w", err)
	}

	signedTx, err := tx.Sign(c.networkPassphrase, c.authority)
	if err != nil {
		return fmt.Errorf("sign authorize trustline transaction: %w", err)
	}

	if _, err := c.horizon.SubmitTransaction(signedTx); err != nil {
		return fmt.Errorf("submit authorize trustline transaction: %w", err)
	}
	return nil
}

// ensureRecipientTrustline re-checks (immediately before a transfer, not
// just at buyer onboarding time, since a trustline can be removed by the
// account holder at any point) that recipient still holds a trustline for
// assetCode issued by this client's authority account. It logs a
// structured, distinct warning and returns ErrTrustlineMissing when the
// trustline is absent, so the caller never attempts the transfer.
func (c *RealStellarClient) ensureRecipientTrustline(ctx context.Context, recipient, assetCode string) error {
	ok, err := c.HasTrustline(ctx, recipient, assetCode, c.authority.Address())
	if err != nil {
		return fmt.Errorf("check recipient trustline: %w", err)
	}
	if !ok {
		slog.Warn("mint blocked: recipient trustline missing",
			"recipient", recipient,
			"asset_code", assetCode,
			"asset_issuer", c.authority.Address(),
		)
		return fmt.Errorf("%w: recipient %s, asset %s", ErrTrustlineMissing, recipient, assetCode)
	}
	return nil
}
