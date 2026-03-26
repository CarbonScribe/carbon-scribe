package workers

import (
	"context"
	"log"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/financing"
)

type PayoutWorker struct {
	service  financing.Service
	interval time.Duration
	logger   *log.Logger
}

func NewPayoutWorker(service financing.Service, interval time.Duration, logger *log.Logger) *PayoutWorker {
	if interval <= 0 {
		interval = 1 * time.Minute
	}
	if logger == nil {
		logger = log.Default()
	}
	return &PayoutWorker{service: service, interval: interval, logger: logger}
}

func (w *PayoutWorker) Run(ctx context.Context) {
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			w.logger.Println("payout worker stopped")
			return
		case <-ticker.C:
			w.logger.Println("payout worker heartbeat")
		}
	}
}

func (w *PayoutWorker) Distribute(ctx context.Context, req financing.DistributeRevenueRequest) (*financing.RevenueDistribution, error) {
	return w.service.DistributeRevenue(ctx, req)
}
