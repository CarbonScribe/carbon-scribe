package workers

import (
	"context"
	"log"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/financing"

	"github.com/google/uuid"
)

type MintingWorker struct {
	service  financing.Service
	interval time.Duration
	logger   *log.Logger
}

func NewMintingWorker(service financing.Service, interval time.Duration, logger *log.Logger) *MintingWorker {
	if interval <= 0 {
		interval = 30 * time.Second
	}
	if logger == nil {
		logger = log.Default()
	}
	return &MintingWorker{service: service, interval: interval, logger: logger}
}

func (w *MintingWorker) Run(ctx context.Context) {
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			w.logger.Println("minting worker stopped")
			return
		case <-ticker.C:
			w.logger.Println("minting worker heartbeat")
		}
	}
}

func (w *MintingWorker) ProcessCredit(ctx context.Context, creditID uuid.UUID, batchSize int) error {
	_, err := w.service.MintCredits(ctx, financing.MintCreditsRequest{
		CreditID:  creditID,
		BatchSize: batchSize,
	})
	return err
}
