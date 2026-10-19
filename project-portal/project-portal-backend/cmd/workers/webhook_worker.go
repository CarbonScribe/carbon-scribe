package workers

import (
	"context"
	"errors"
	"log"
	"sync"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/integration"
)

// WebhookWorker handles retrying failed webhook deliveries with exponential backoff.
// It polls the database for failed deliveries that are due for retry and attempts delivery.
type WebhookWorker struct {
	integrationService webhookDeliveryService
	interval           time.Duration
	logger             *log.Logger
	mu                 sync.Mutex
}

type webhookDeliveryService interface {
	ListPendingWebhookDeliveries(ctx context.Context, before time.Time) ([]integration.WebhookDelivery, error)
	DeliverWebhookByID(ctx context.Context, deliveryID string) error
}

// NewWebhookWorker creates a new webhook worker with the given dependencies.
// If interval is <= 0, defaults to 1 minute for production.
// If logger is nil, uses the default logger.
func NewWebhookWorker(
	integrationService *integration.Service,
	interval time.Duration,
	logger *log.Logger,
) *WebhookWorker {
	if interval <= 0 {
		interval = 1 * time.Minute
	}
	if logger == nil {
		logger = log.Default()
	}

	return &WebhookWorker{
		integrationService: integrationService,
		interval:           interval,
		logger:             logger,
	}
}

// Run begins the webhook worker loop and blocks until context is cancelled.
// Returns error if context is nil.
func (w *WebhookWorker) Run(ctx context.Context) error {
	if ctx == nil {
		return errors.New("context cannot be nil")
	}

	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	w.logger.Printf("webhook worker started with interval: %v\n", w.interval)

	for {
		select {
		case <-ctx.Done():
			w.logger.Println("webhook worker: context cancelled, initiating graceful shutdown")
			return ctx.Err()

		case <-ticker.C:
			w.processRetryQueue(ctx)
		}
	}
}

// processRetryQueue orchestrates the main retry workflow:
// 1. Query for failed deliveries due for retry
// 2. Attempt delivery for each
// 3. Handle success/failure and update retry schedule
func (w *WebhookWorker) processRetryQueue(ctx context.Context) {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.logger.Println("webhook worker: triggered retry cycle")

	// Get all failed deliveries that are due for retry
	deliveries, err := w.integrationService.ListPendingWebhookDeliveries(ctx, time.Now())
	if err != nil {
		w.logger.Printf("webhook worker: failed to list pending deliveries: %v\n", err)
		return
	}

	if len(deliveries) == 0 {
		w.logger.Println("webhook worker: no pending deliveries to retry")
		return
	}

	w.logger.Printf("webhook worker: found %d pending deliveries to retry\n", len(deliveries))

	// Process each delivery
	for _, delivery := range deliveries {
		// Check context for cancellation
		select {
		case <-ctx.Done():
			w.logger.Println("webhook worker: context cancelled during retry cycle")
			return
		default:
		}

		w.logger.Printf("webhook worker: retrying delivery %s (attempt %d)\n", delivery.ID, delivery.Attempt+1)

		if err := w.integrationService.DeliverWebhookByID(ctx, delivery.ID); err != nil {
			w.logger.Printf("webhook worker: failed to retry delivery %s: %v\n", delivery.ID, err)
		} else {
			w.logger.Printf("webhook worker: successfully retried delivery %s\n", delivery.ID)
		}
	}

	w.logger.Println("webhook worker: retry cycle completed")
}
