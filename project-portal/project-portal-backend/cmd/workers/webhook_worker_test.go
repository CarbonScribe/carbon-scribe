package workers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/integration"
)

// mockIntegrationService is a mock implementation of the integration.Service for testing
type mockIntegrationService struct {
	listPendingDeliveries []integration.WebhookDelivery
	listPendingErr        error
	deliverByIDErr        error
	deliveredIDs          []string
}

func (m *mockIntegrationService) ListPendingWebhookDeliveries(ctx context.Context, before time.Time) ([]integration.WebhookDelivery, error) {
	if m.listPendingErr != nil {
		return nil, m.listPendingErr
	}
	return m.listPendingDeliveries, nil
}

func (m *mockIntegrationService) DeliverWebhookByID(ctx context.Context, deliveryID string) error {
	m.deliveredIDs = append(m.deliveredIDs, deliveryID)
	if m.deliverByIDErr != nil {
		return m.deliverByIDErr
	}
	return nil
}

func TestWebhookWorker_ProcessRetryQueue(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	deliveryID1 := "delivery-1"
	deliveryID2 := "delivery-2"

	mockService := &mockIntegrationService{
		listPendingDeliveries: []integration.WebhookDelivery{
			{ID: deliveryID1},
			{ID: deliveryID2},
		},
	}

	worker := NewWebhookWorker(nil, 0, nil)
	worker.integrationService = mockService

	// Process retry queue
	worker.processRetryQueue(context.Background())

	// Verify both deliveries were attempted
	if len(mockService.deliveredIDs) != 2 {
		t.Errorf("expected 2 deliveries to be attempted, got %d", len(mockService.deliveredIDs))
	}

	// Verify the correct IDs were delivered
	for _, id := range []string{deliveryID1, deliveryID2} {
		found := false
		for _, deliveredID := range mockService.deliveredIDs {
			if deliveredID == id {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("expected delivery ID %s to be attempted", id)
		}
	}
}

func TestWebhookWorker_ProcessRetryQueue_EmptyQueue(t *testing.T) {
	mockService := &mockIntegrationService{
		listPendingDeliveries: []integration.WebhookDelivery{},
	}

	worker := NewWebhookWorker(nil, 0, nil)
	worker.integrationService = mockService

	// Process retry queue with no pending deliveries
	worker.processRetryQueue(context.Background())

	// Verify no deliveries were attempted
	if len(mockService.deliveredIDs) != 0 {
		t.Errorf("expected 0 deliveries to be attempted, got %d", len(mockService.deliveredIDs))
	}
}

func TestWebhookWorker_ProcessRetryQueue_ListError(t *testing.T) {
	mockService := &mockIntegrationService{
		listPendingErr: errors.New("database error"),
	}

	worker := NewWebhookWorker(nil, 0, nil)
	worker.integrationService = mockService

	// Process retry queue with list error - should not panic
	worker.processRetryQueue(context.Background())

	// Verify no deliveries were attempted
	if len(mockService.deliveredIDs) != 0 {
		t.Errorf("expected 0 deliveries to be attempted on error, got %d", len(mockService.deliveredIDs))
	}
}

func TestWebhookWorker_ProcessRetryQueue_DeliveryError(t *testing.T) {
	deliveryID := "delivery-1"

	mockService := &mockIntegrationService{
		listPendingDeliveries: []integration.WebhookDelivery{
			{ID: deliveryID},
		},
		deliverByIDErr: errors.New("delivery failed"),
	}

	worker := NewWebhookWorker(nil, 0, nil)
	worker.integrationService = mockService

	// Process retry queue with delivery error - should not panic
	worker.processRetryQueue(context.Background())

	// Verify delivery was attempted despite error
	if len(mockService.deliveredIDs) != 1 {
		t.Errorf("expected delivery to be attempted even with error, got %d attempts", len(mockService.deliveredIDs))
	}
}

func TestWebhookWorker_ContextCancellation(t *testing.T) {
	mockService := &mockIntegrationService{
		listPendingDeliveries: []integration.WebhookDelivery{
			{ID: "delivery-1"},
		},
	}

	worker := NewWebhookWorker(nil, 0, nil)
	worker.integrationService = mockService

	// Create a context that's already cancelled
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	// Process retry queue with cancelled context
	worker.processRetryQueue(ctx)

	// Verify no deliveries were attempted due to cancellation
	if len(mockService.deliveredIDs) != 0 {
		t.Errorf("expected 0 deliveries to be attempted on context cancellation, got %d", len(mockService.deliveredIDs))
	}
}

func TestNewWebhookWorker_DefaultValues(t *testing.T) {
	worker := NewWebhookWorker(nil, 0, nil)

	if worker.interval != 1*time.Minute {
		t.Errorf("expected default interval of 1 minute, got %v", worker.interval)
	}

	if worker.logger == nil {
		t.Error("expected default logger to be set")
	}
}

func TestWebhookWorker_Run_ContextCancellation(t *testing.T) {
	mockService := &mockIntegrationService{
		listPendingDeliveries: []integration.WebhookDelivery{},
	}

	worker := NewWebhookWorker(nil, 10*time.Millisecond, nil)
	worker.integrationService = mockService

	// Create a context that will be cancelled after a short delay
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel()
	}()

	// Run the worker - should exit gracefully on context cancellation
	err := worker.Run(ctx)

	if err != context.Canceled {
		t.Errorf("expected context.Canceled error, got %v", err)
	}
}

func TestWebhookWorker_Run_NilContext(t *testing.T) {
	worker := NewWebhookWorker(nil, 10*time.Millisecond, nil)

	// Run with nil context - should return error
	err := worker.Run(nil)

	if err == nil {
		t.Error("expected error for nil context")
	}
}
