package tokenization

import (
	"context"
	"fmt"
	"log"

	"github.com/CarbonScribe/carbon-scribe/project-portal/project-portal-backend/internal/project/quality"
	"github.com/stellar/go/clients/horizonclient"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/txnbuild"
)

// QualityUpdater pushes quality scores from the database to the Carbon Asset
// contract by calling update_quality_score() on each project's token.
type QualityUpdater struct {
	repo              quality.ScoreRepository
	horizon           *horizonclient.Client
	carbonAssetContractID string // CAW7LUESK5RWH75W7IL64HYREFM5CPSFASBVVPVO2XOBC6AKHW4WJ6TM
	callerKeypair     *keypair.Full
	networkPassphrase string
}

func NewQualityUpdater(
	repo quality.ScoreRepository,
	horizon *horizonclient.Client,
	carbonAssetContractID string,
	callerKeypair *keypair.Full,
	networkPassphrase string,
) *QualityUpdater {
	return &QualityUpdater{
		repo:                  repo,
		horizon:               horizon,
		carbonAssetContractID: carbonAssetContractID,
		callerKeypair:         callerKeypair,
		networkPassphrase:     networkPassphrase,
	}
}

// SyncAllScores fetches every current quality score from the database and
// pushes each one to the Carbon Asset contract via update_quality_score().
func (u *QualityUpdater) SyncAllScores(ctx context.Context) error {
	scores, err := u.repo.GetAllProjectScores(ctx)
	if err != nil {
		return fmt.Errorf("fetch scores for sync: %w", err)
	}

	var errs []error
	for _, s := range scores {
		if err := u.UpdateContractScore(ctx, s.MethodologyTokenID, s.OverallScore); err != nil {
			log.Printf("warn: update_quality_score failed for token %d: %v", s.MethodologyTokenID, err)
			errs = append(errs, err)
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("%d score updates failed (first: %w)", len(errs), errs[0])
	}
	return nil
}

// UpdateContractScore calls update_quality_score(token_id, score) on the
// Carbon Asset contract for a single methodology token.
func (u *QualityUpdater) UpdateContractScore(ctx context.Context, tokenID int, score int) error {
	account, err := u.horizon.AccountDetail(horizonclient.AccountRequest{
		AccountID: u.callerKeypair.Address(),
	})
	if err != nil {
		return fmt.Errorf("fetch account: %w", err)
	}

	tokenIDU32 := uint32(tokenID)
	scoreU32 := uint32(score)

	invokeOp := txnbuild.InvokeHostFunction{
		HostFunction: txnbuild.HostFunction{
			InvokeContract: &txnbuild.InvokeContractArgs{
				ContractAddress: u.carbonAssetContractID,
				FunctionName:    "update_quality_score",
				Args: []txnbuild.ScVal{
					{Type: txnbuild.ScValTypeScvU32, U32: &tokenIDU32},
					{Type: txnbuild.ScValTypeScvU32, U32: &scoreU32},
				},
			},
		},
		SourceAccount: u.callerKeypair.Address(),
	}

	tx, err := txnbuild.NewTransaction(txnbuild.TransactionParams{
		SourceAccount:        &account,
		IncrementSequenceNum: true,
		Operations:           []txnbuild.Operation{&invokeOp},
		BaseFee:              txnbuild.MinBaseFee,
		Preconditions:        txnbuild.Preconditions{TimeBounds: txnbuild.NewInfiniteTimeout()},
	})
	if err != nil {
		return fmt.Errorf("build tx: %w", err)
	}

	tx, err = tx.Sign(u.networkPassphrase, u.callerKeypair)
	if err != nil {
		return fmt.Errorf("sign tx: %w", err)
	}

	txXDR, err := tx.ToXDR()
	if err != nil {
		return fmt.Errorf("encode tx: %w", err)
	}

	_, err = u.horizon.SubmitTransactionXDR(txXDR)
	if err != nil {
		return fmt.Errorf("submit update_quality_score(token=%d, score=%d): %w", tokenID, score, err)
	}

	log.Printf("info: updated quality score on contract — token=%d score=%d", tokenID, score)
	return nil
}