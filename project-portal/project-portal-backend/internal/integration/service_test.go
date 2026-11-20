package integration

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
)

// mockRepository is a mock implementation of the Repository interface for testing
type mockRepository struct {
	subscriptions         []EventSubscription
	deliveries            []WebhookDelivery
	createDeliveryErr     error
	getDeliveryErr        error
	updateDeliveryErr     error
	listPendingDeliveries []WebhookDelivery
	recordedHealth        *IntegrationHealth
	connection            *IntegrationConnection
}

func (m *mockRepository) CreateConnection(ctx context.Context, conn *IntegrationConnection) error {
	return nil
}

func (m *mockRepository) GetConnection(ctx context.Context, id string) (*IntegrationConnection, error) {
	if m.connection != nil {
		return m.connection, nil
	}
	return &IntegrationConnection{ID: id, Provider: "stripe"}, nil
}

func (m *mockRepository) GetConnectionByProvider(ctx context.Context, provider string) (*IntegrationConnection, error) {
	return nil, nil
}

func (m *mockRepository) ListConnections(ctx context.Context) ([]IntegrationConnection, error) {
	return nil, nil
}

func (m *mockRepository) UpdateConnection(ctx context.Context, conn *IntegrationConnection) error {
	m.connection = conn
	return nil
}

func (m *mockRepository) DeleteConnection(ctx context.Context, id string) error {
	return nil
}

func (m *mockRepository) CreateWebhookConfig(ctx context.Context, webhook *WebhookConfig) error {
	return nil
}

func (m *mockRepository) ListWebhookConfigs(ctx context.Context, projectID *string) ([]WebhookConfig, error) {
	return nil, nil
}

func (m *mockRepository) GetWebhookConfig(ctx context.Context, id string) (*WebhookConfig, error) {
	return nil, nil
}

func (m *mockRepository) CreateWebhookDelivery(ctx context.Context, delivery *WebhookDelivery) error {
	if m.createDeliveryErr != nil {
		return m.createDeliveryErr
	}
	m.deliveries = append(m.deliveries, *delivery)
	return nil
}

func (m *mockRepository) GetWebhookDelivery(ctx context.Context, id string) (*WebhookDelivery, error) {
	if m.getDeliveryErr != nil {
		return nil, m.getDeliveryErr
	}
	for i := range m.deliveries {
		if m.deliveries[i].ID == id {
			return &m.deliveries[i], nil
		}
	}
	return nil, nil
}

func (m *mockRepository) UpdateWebhookDelivery(ctx context.Context, delivery *WebhookDelivery) error {
	if m.updateDeliveryErr != nil {
		return m.updateDeliveryErr
	}
	for i := range m.deliveries {
		if m.deliveries[i].ID == delivery.ID {
			m.deliveries[i] = *delivery
			break
		}
	}
	return nil
}

func (m *mockRepository) ListPendingWebhookDeliveries(ctx context.Context, before time.Time) ([]WebhookDelivery, error) {
	return m.listPendingDeliveries, nil
}

func (m *mockRepository) CreateSubscription(ctx context.Context, sub *EventSubscription) error {
	return nil
}

func (m *mockRepository) ListSubscriptions(ctx context.Context, eventType string) ([]EventSubscription, error) {
	return m.subscriptions, nil
}

func (m *mockRepository) SaveOAuthToken(ctx context.Context, token *OAuthToken) error {
	return nil
}

func (m *mockRepository) GetOAuthToken(ctx context.Context, connectionID string) (*OAuthToken, error) {
	return nil, nil
}

func (m *mockRepository) CreateOAuthState(ctx context.Context, state *OAuthState) error {
	return nil
}

func (m *mockRepository) GetOAuthStateByState(ctx context.Context, state string) (*OAuthState, error) {
	return nil, nil
}

func (m *mockRepository) MarkOAuthStateConsumed(ctx context.Context, state string) error {
	return nil
}

func (m *mockRepository) DeleteExpiredOAuthStates(ctx context.Context, before time.Time) error {
	return nil
}

func (m *mockRepository) RecordHealth(ctx context.Context, health *IntegrationHealth) error {
	m.recordedHealth = health
	return nil
}

func (m *mockRepository) GetLatestHealth(ctx context.Context, connectionID string) (*IntegrationHealth, error) {
	return nil, nil
}

func TestPlaceholderHealthCheckLatencyMsConstant(t *testing.T) {
	if PlaceholderHealthCheckLatencyMs != 45 {
		t.Fatalf("expected placeholder latency 45, got %d", PlaceholderHealthCheckLatencyMs)
	}
}

func TestTestConnectionUsesPlaceholderLatency(t *testing.T) {
	repo := &mockRepository{}
	service := NewService(repo)

	if err := service.TestConnection(context.Background(), "conn-123"); err != nil {
		t.Fatalf("TestConnection failed: %v", err)
	}
	if repo.recordedHealth == nil {
		t.Fatal("expected health to be recorded")
	}
	if got := repo.recordedHealth.LatencyMs; got != PlaceholderHealthCheckLatencyMs {
		t.Errorf("expected latency %d, got %d", PlaceholderHealthCheckLatencyMs, got)
	}
}

func TestTriggerWebhook_SuccessfulDelivery(t *testing.T) {
	const secret = "webhook-test-secret"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("failed reading webhook request: %v", err)
		}
		mac := hmac.New(sha256.New, []byte(secret))
		_, _ = mac.Write(body)
		if got, want := r.Header.Get(webhookSignatureHeader), hex.EncodeToString(mac.Sum(nil)); got != want {
			t.Errorf("unexpected webhook signature: got %q, want %q", got, want)
		}
		if got := r.Header.Get("X-Webhook-Event"); got != "test.event" {
			t.Errorf("unexpected event header: got %q", got)
		}
		if got := r.Header.Get("Content-Type"); got != "application/json" {
			t.Errorf("unexpected content type: got %q", got)
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"received"}`))
	}))
	defer server.Close()

	subID := uuid.New().String()
	mockRepo := &mockRepository{
		subscriptions: []EventSubscription{
			{
				ID:          subID,
				EventType:   "test.event",
				CallbackURL: server.URL,
				Secret:      secret,
				IsActive:    true,
			},
		},
	}

	service := NewService(mockRepo)
	service.HTTPClient = server.Client()

	payload := map[string]any{"test": "data"}

	err := service.TriggerWebhook(context.Background(), "test.event", payload)
	if err != nil {
		t.Fatalf("TriggerWebhook failed: %v", err)
	}

	// Verify delivery was created and marked as success
	if len(mockRepo.deliveries) != 1 {
		t.Fatalf("expected 1 delivery, got %d", len(mockRepo.deliveries))
	}

	delivery := mockRepo.deliveries[0]
	if delivery.Status != "success" {
		t.Errorf("expected status 'success', got '%s'", delivery.Status)
	}
	if delivery.ResponseStatus != 200 {
		t.Errorf("expected response status 200, got %d", delivery.ResponseStatus)
	}
	if delivery.Attempt != 1 {
		t.Errorf("expected 1 attempt, got %d", delivery.Attempt)
	}
}

func TestTriggerWebhook_FailedDeliveryWithRetry(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts == 1 {
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"error":"temporary error"}`))
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	subID := uuid.New().String()
	mockRepo := &mockRepository{
		subscriptions: []EventSubscription{
			{
				ID:          subID,
				EventType:   "test.event",
				CallbackURL: server.URL,
				Secret:      "test-secret",
				IsActive:    true,
			},
		},
	}

	service := NewService(mockRepo)
	service.HTTPClient = server.Client()

	payload := map[string]any{"test": "data"}

	err := service.TriggerWebhook(context.Background(), "test.event", payload)
	if err != nil {
		t.Fatalf("TriggerWebhook failed: %v", err)
	}

	// Verify delivery was created and marked as failed with retry scheduled
	if len(mockRepo.deliveries) != 1 {
		t.Fatalf("expected 1 delivery, got %d", len(mockRepo.deliveries))
	}

	delivery := mockRepo.deliveries[0]
	if delivery.Status != "failed" {
		t.Errorf("expected status 'failed', got '%s'", delivery.Status)
	}
	if delivery.ResponseStatus != 500 {
		t.Errorf("expected response status 500, got %d", delivery.ResponseStatus)
	}
	if delivery.NextRetryAt == nil {
		t.Error("expected NextRetryAt to be set for failed delivery")
	}

	due := time.Now().Add(-time.Second)
	mockRepo.deliveries[0].NextRetryAt = &due
	if err := service.DeliverWebhookByID(context.Background(), delivery.ID); err != nil {
		t.Fatalf("retry delivery: %v", err)
	}
	delivery = mockRepo.deliveries[0]
	if delivery.Status != "success" {
		t.Errorf("expected retried delivery to succeed, got %q", delivery.Status)
	}
	if delivery.Attempt != 2 {
		t.Errorf("expected 2 attempts, got %d", delivery.Attempt)
	}
	if attempts != 2 {
		t.Errorf("expected 2 HTTP requests, got %d", attempts)
	}
}

func TestDeliverWebhookByID_RecoversPendingDelivery(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	subID := uuid.NewString()
	deliveryID := uuid.NewString()
	repo := &mockRepository{
		subscriptions: []EventSubscription{{
			ID:          subID,
			EventType:   "test.event",
			CallbackURL: server.URL,
			Secret:      "test-secret",
			IsActive:    true,
		}},
		deliveries: []WebhookDelivery{{
			ID:        deliveryID,
			WebhookID: subID,
			EventType: "test.event",
			Status:    "pending",
			Payload:   map[string]any{"test": "data"},
		}},
	}
	service := NewService(repo)
	service.HTTPClient = server.Client()

	if err := service.DeliverWebhookByID(context.Background(), deliveryID); err != nil {
		t.Fatalf("recover pending delivery: %v", err)
	}
	delivery, err := repo.GetWebhookDelivery(context.Background(), deliveryID)
	if err != nil {
		t.Fatalf("get recovered delivery: %v", err)
	}
	if delivery.Status != "success" || delivery.Attempt != 1 {
		t.Errorf("expected recovered delivery success on attempt 1, got status %q attempt %d", delivery.Status, delivery.Attempt)
	}
}

func TestDeliverWebhookByID_DeadLettersAfterMaxAttempts(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"permanent error"}`))
	}))
	defer server.Close()

	subID := uuid.New().String()
	deliveryID := uuid.New().String()
	due := time.Now().Add(-time.Second)
	mockRepo := &mockRepository{
		subscriptions: []EventSubscription{
			{
				ID:          subID,
				EventType:   "test.event",
				CallbackURL: server.URL,
				Secret:      "test-secret",
				IsActive:    true,
			},
		},
		deliveries: []WebhookDelivery{
			{
				ID:          deliveryID,
				WebhookID:   subID,
				EventType:   "test.event",
				Status:      "failed",
				Attempt:     MaxRetryAttempts - 1,
				Payload:     map[string]any{"test": "data"},
				NextRetryAt: &due,
			},
		},
	}

	service := NewService(mockRepo)
	service.HTTPClient = server.Client()

	if err := service.DeliverWebhookByID(context.Background(), deliveryID); err == nil {
		t.Fatal("expected HTTP delivery failure")
	}
	delivery, err := mockRepo.GetWebhookDelivery(context.Background(), deliveryID)
	if err != nil {
		t.Fatalf("failed to get delivery: %v", err)
	}
	if delivery.Status != "dead_letter" {
		t.Errorf("expected dead_letter status, got %q", delivery.Status)
	}
	if delivery.Attempt != MaxRetryAttempts {
		t.Errorf("expected %d attempts, got %d", MaxRetryAttempts, delivery.Attempt)
	}
	if delivery.NextRetryAt != nil {
		t.Errorf("expected no retry time for dead-lettered delivery, got %v", delivery.NextRetryAt)
	}
	if err := service.DeliverWebhookByID(context.Background(), deliveryID); err != nil {
		t.Fatalf("dead-lettered delivery should not be retried: %v", err)
	}
	if requests != 1 {
		t.Errorf("expected dead-lettered delivery to receive no further attempts, got %d requests", requests)
	}
}

func TestTriggerWebhook_PropagatesCreateError(t *testing.T) {
	wantErr := errors.New("database unavailable")
	repo := &mockRepository{
		createDeliveryErr: wantErr,
		subscriptions: []EventSubscription{{
			ID:        uuid.NewString(),
			EventType: "test.event",
			IsActive:  true,
		}},
	}
	service := NewService(repo)

	err := service.TriggerWebhook(context.Background(), "test.event", map[string]any{"test": "data"})
	if !errors.Is(err, wantErr) {
		t.Fatalf("expected CreateWebhookDelivery error to be propagated, got %v", err)
	}
}

func TestWebhookRetryDelayExponentialAndCapped(t *testing.T) {
	if got, want := webhookRetryDelay(1), time.Minute; got != want {
		t.Errorf("attempt 1 delay = %v, want %v", got, want)
	}
	if got, want := webhookRetryDelay(2), 2*time.Minute; got != want {
		t.Errorf("attempt 2 delay = %v, want %v", got, want)
	}
	if got, want := webhookRetryDelay(3), 4*time.Minute; got != want {
		t.Errorf("attempt 3 delay = %v, want %v", got, want)
	}
	if got, want := webhookRetryDelay(20), time.Hour; got != want {
		t.Errorf("large attempt delay = %v, want cap %v", got, want)
	}
}
