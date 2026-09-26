package workers

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/compliance"
	"carbon-scribe/project-portal/project-portal-backend/internal/compliance/requests"
	"carbon-scribe/project-portal/project-portal-backend/internal/notifications"
)

// ComplianceRequestWorker processes pending privacy data subject requests.
//
// Responsibilities:
//   - Poll for requests in "received" status
//   - For deletion requests: check legal holds, execute deletion, update request
//   - Send notifications on completion or failure
//   - Enforce jurisdiction-specific response deadlines (e.g., GDPR 30 days)
//
// This worker runs continuously on a short interval (every 5 minutes).
type ComplianceRequestWorker struct {
	repo               compliance.Repository
	processor          *requests.Processor
	notificationSvc    *notifications.Service
	interval           time.Duration
	logger             *log.Logger
	batchSize          int
}

// NewComplianceRequestWorker creates a new compliance request worker.
func NewComplianceRequestWorker(
	repo compliance.Repository,
	notificationSvc *notifications.Service,
	interval time.Duration,
	logger *log.Logger,
) *ComplianceRequestWorker {
	if interval <= 0 {
		interval = 5 * time.Minute
	}
	if logger == nil {
		logger = log.Default()
	}
	return &ComplianceRequestWorker{
		repo:            repo,
		processor:       requests.NewProcessor(repo),
		notificationSvc: notificationSvc,
		interval:        interval,
		logger:          logger,
		batchSize:       50,
	}
}

// Run starts the worker polling loop. It blocks until the context is cancelled.
func (w *ComplianceRequestWorker) Run(ctx context.Context) {
	w.logger.Println("compliance request worker started")
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	w.processPending(ctx)

	for {
		select {
		case <-ctx.Done():
			w.logger.Println("compliance request worker stopped")
			return
		case <-ticker.C:
			w.processPending(ctx)
		}
	}
}

// processPending fetches and processes all pending deletion requests.
func (w *ComplianceRequestWorker) processPending(ctx context.Context) {
	requests_list, err := w.repo.GetPendingRequests(ctx, compliance.RequestTypeDeletion, w.batchSize)
	if err != nil {
		w.logger.Printf("failed to fetch pending deletion requests: %v", err)
		return
	}

	if len(requests_list) == 0 {
		return
	}

	w.logger.Printf("processing %d pending deletion request(s)", len(requests_list))

	for _, req := range requests_list {
		w.processOne(ctx, &req)
	}
}

// processOne handles a single deletion request end-to-end.
func (w *ComplianceRequestWorker) processOne(ctx context.Context, req *compliance.PrivacyRequest) {
	w.logger.Printf("processing deletion request %s for user %s", req.ID, req.UserID)

	req.Status = compliance.RequestStatusProcessing
	if err := w.repo.UpdatePrivacyRequest(ctx, req); err != nil {
		w.logger.Printf("failed to mark request %s as processing: %v", req.ID, err)
		return
	}

	result, err := w.processor.ProcessDeletionRequest(ctx, req.UserID, req.DataCategories)
	if err != nil {
		w.logger.Printf("deletion request %s failed: %v", req.ID, err)
		w.markFailed(ctx, req, err.Error())
		return
	}

	summaryJSON, marshalErr := json.Marshal(result.Summary)
	if marshalErr != nil {
		w.logger.Printf("failed to marshal deletion summary for request %s: %v", req.ID, marshalErr)
	}

	now := time.Now()
	req.Status = compliance.RequestStatusCompleted
	req.CompletedAt = &now
	req.DeletionSummary = map[string]any{
		"deleted_categories":  result.DeletedCategories,
		"retained_categories": result.RetainedCategories,
		"summary":             json.RawMessage(summaryJSON),
	}

	if err := w.repo.UpdatePrivacyRequest(ctx, req); err != nil {
		w.logger.Printf("failed to mark request %s as completed: %v", req.ID, err)
		return
	}

	w.logger.Printf("deletion request %s completed: deleted=%v retained=%v",
		req.ID, result.DeletedCategories, result.RetainedCategories)

	w.notifyCompletion(ctx, req, result)
}

// markFailed transitions a request to failed status with an error message.
func (w *ComplianceRequestWorker) markFailed(ctx context.Context, req *compliance.PrivacyRequest, errorMsg string) {
	now := time.Now()
	req.Status = compliance.RequestStatusFailed
	req.CompletedAt = &now
	req.ErrorMessage = errorMsg

	if err := w.repo.UpdatePrivacyRequest(ctx, req); err != nil {
		w.logger.Printf("failed to mark request %s as failed: %v", req.ID, err)
		return
	}

	w.notifyFailure(ctx, req, errorMsg)
}

// notifyCompletion sends a notification when a deletion request completes successfully.
func (w *ComplianceRequestWorker) notifyCompletion(ctx context.Context, req *compliance.PrivacyRequest, result *requests.DeletionResult) {
	if w.notificationSvc == nil {
		return
	}

	summaryJSON, _ := json.MarshalIndent(result.Summary, "", "  ")

	_, err := w.notificationSvc.SendNotification(ctx, notifications.SendNotificationRequest{
		UserID:   req.UserID,
		Category: "compliance",
		Subject:  "Your data deletion request has been completed",
		Content:  "Your GDPR deletion request has been processed. Deleted categories: " + joinStrings(result.DeletedCategories) + ".\n\nSummary:\n" + string(summaryJSON),
		Channels: []string{notifications.ChannelInApp},
		Metadata: map[string]interface{}{
			"request_id":   req.ID,
			"request_type": req.RequestType,
			"status":       req.Status,
		},
	})
	if err != nil {
		w.logger.Printf("failed to send completion notification for request %s: %v", req.ID, err)
	}
}

// notifyFailure sends a notification when a deletion request fails.
func (w *ComplianceRequestWorker) notifyFailure(ctx context.Context, req *compliance.PrivacyRequest, errorMsg string) {
	if w.notificationSvc == nil {
		return
	}

	_, err := w.notificationSvc.SendNotification(ctx, notifications.SendNotificationRequest{
		UserID:   req.UserID,
		Category: "compliance",
		Subject:  "Your data deletion request could not be completed",
		Content:  "Your GDPR deletion request could not be processed. Our team has been notified. Error: " + errorMsg,
		Channels: []string{notifications.ChannelInApp},
		Metadata: map[string]interface{}{
			"request_id":   req.ID,
			"request_type": req.RequestType,
			"status":       req.Status,
			"error":        errorMsg,
		},
	})
	if err != nil {
		w.logger.Printf("failed to send failure notification for request %s: %v", req.ID, err)
	}
}

func joinStrings(items []string) string {
	if len(items) == 0 {
		return "none"
	}
	result := ""
	for i, s := range items {
		if i > 0 {
			result += ", "
		}
		result += s
	}
	return result
}
