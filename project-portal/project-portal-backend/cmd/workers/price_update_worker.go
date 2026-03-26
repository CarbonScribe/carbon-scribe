package workers

import (
	"context"
	"log"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/financing"
)

type PriceUpdateWorker struct {
	service  financing.Service
	interval time.Duration
	logger   *log.Logger
}

func NewPriceUpdateWorker(service financing.Service, interval time.Duration, logger *log.Logger) *PriceUpdateWorker {
	if interval <= 0 {
		interval = 2 * time.Minute
	}
	if logger == nil {
		logger = log.Default()
	}
	return &PriceUpdateWorker{service: service, interval: interval, logger: logger}
}

func (w *PriceUpdateWorker) Run(ctx context.Context) {
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			w.logger.Println("price update worker stopped")
			return
		case <-ticker.C:
			w.logger.Println("price update worker heartbeat")
		}
	}
}

func (w *PriceUpdateWorker) Quote(ctx context.Context, methodologyCode, regionCode string, vintageYear int, quality float64) (*financing.PricingQuoteResponse, error) {
	return w.service.GetPriceQuote(ctx, methodologyCode, regionCode, vintageYear, quality)
}
