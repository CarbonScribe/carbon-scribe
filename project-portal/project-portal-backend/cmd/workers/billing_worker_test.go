package workers

import (
	"context"
	"errors"
	"io"
	"log"
	"testing"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/settings"

	"github.com/google/uuid"
)

// Mock implementations for testing
type mockSettingsService struct {
	billingFunc func(ctx context.Context, userID uuid.UUID) (*settings.BillingSummary, error)
}

func (m *mockSettingsService) GetBilling(ctx context.Context, userID uuid.UUID) (*settings.BillingSummary, error) {
	if m.billingFunc != nil {
		return m.billingFunc(ctx, userID)
	}
	return nil, errors.New("mock billing not implemented")
}

func (m *mockSettingsService) GetProfile(ctx context.Context, userID uuid.UUID) (*settings.UserProfile, error) {
	return nil, errors.New("not implemented")
}

func (m *mockSettingsService) UpdateProfile(ctx context.Context, userID uuid.UUID, req settings.UpdateProfileRequest) (*settings.UserProfile, error) {
	return nil, errors.New("not implemented")
}

func (m *mockSettingsService) UploadProfilePicture(ctx context.Context, userID uuid.UUID, filename string) (*settings.ProfilePictureUploadResponse, error) {
	return nil, errors.New("not implemented")
}

func (m *mockSettingsService) ExportProfile(ctx context.Context, userID uuid.UUID, format string) ([]byte, string, error) {
	return nil, "", errors.New("not implemented")
}

func (m *mockSettingsService) DeleteProfile(ctx context.Context, userID uuid.UUID) (*settings.DeleteProfileResponse, error) {
	return nil, errors.New("not implemented")
}

func (m *mockSettingsService) GetNotifications(ctx context.Context, userID uuid.UUID) (*settings.NotificationPreference, error) {
	return nil, errors.New("not implemented")
}

func (m *mockSettingsService) UpdateNotifications(ctx context.Context, userID uuid.UUID, req settings.UpdateNotificationPreferencesRequest) (*settings.NotificationPreference, error) {
	return nil, errors.New("not implemented")
}

func (m *mockSettingsService) ListAPIKeys(ctx context.Context, userID uuid.UUID) ([]settings.APIKeyPublic, error) {
	return nil, errors.New("not implemented")
}

func (m *mockSettingsService) CreateAPIKey(ctx context.Context, userID uuid.UUID, req settings.CreateAPIKeyRequest) (*settings.CreateAPIKeyResponse, error) {
	return nil, errors.New("not implemented")
}

func (m *mockSettingsService) RevokeAPIKey(ctx context.Context, userID, keyID uuid.UUID) error {
	return errors.New("not implemented")
}

func (m *mockSettingsService) RotateAPIKey(ctx context.Context, userID, keyID uuid.UUID) (*settings.CreateAPIKeyResponse, error) {
	return nil, errors.New("not implemented")
}

func (m *mockSettingsService) GetAPIKeyUsage(ctx context.Context, userID, keyID uuid.UUID) (*settings.APIKeyUsageAnalytics, error) {
	return nil, errors.New("not implemented")
}

func (m *mockSettingsService) ConfigureAPIKeyWebhooks(ctx context.Context, userID, keyID uuid.UUID, req settings.ConfigureAPIKeyWebhooksRequest) (*settings.APIKeyPublic, error) {
	return nil, errors.New("not implemented")
}

func (m *mockSettingsService) ValidateAPIKeySecret(ctx context.Context, req settings.ValidateAPIKeyRequest) (*settings.ValidateAPIKeyResponse, error) {
	return nil, errors.New("not implemented")
}

func (m *mockSettingsService) ListIntegrations(ctx context.Context, userID uuid.UUID) ([]settings.IntegrationConfigurationPublic, error) {
	return nil, errors.New("not implemented")
}

func (m *mockSettingsService) ConfigureIntegration(ctx context.Context, userID uuid.UUID, req settings.ConfigureIntegrationRequest) (*settings.IntegrationConfigurationPublic, error) {
	return nil, errors.New("not implemented")
}

func (m *mockSettingsService) BatchConfigureIntegrations(ctx context.Context, userID uuid.UUID, req settings.BatchConfigureIntegrationsRequest) ([]settings.IntegrationConfigurationPublic, error) {
	return nil, errors.New("not implemented")
}

func (m *mockSettingsService) StartOAuthFlow(ctx context.Context, userID uuid.UUID, provider string) (*settings.OAuthStartResponse, error) {
	return nil, errors.New("not implemented")
}

func (m *mockSettingsService) CompleteOAuthFlow(ctx context.Context, userID uuid.UUID, provider string, req settings.OAuthCallbackRequest) (*settings.OAuthCallbackResponse, error) {
	return nil, errors.New("not implemented")
}

func (m *mockSettingsService) GetIntegrationHealth(ctx context.Context, userID, integrationID uuid.UUID) (*settings.IntegrationHealthResponse, error) {
	return nil, errors.New("not implemented")
}

func (m *mockSettingsService) ListInvoices(ctx context.Context, userID uuid.UUID) ([]settings.Invoice, error) {
	return nil, errors.New("not implemented")
}

func (m *mockSettingsService) GetInvoicePDF(ctx context.Context, userID, invoiceID uuid.UUID) (*settings.InvoicePDFResponse, error) {
	return nil, errors.New("not implemented")
}

func (m *mockSettingsService) AddPaymentMethod(ctx context.Context, userID uuid.UUID, req settings.AddPaymentMethodRequest) (*settings.Subscription, error) {
	return nil, errors.New("not implemented")
}

type mockInvoiceGenerator struct {
	generateFunc func(invoiceNumber string) (string, error)
}

func (m *mockInvoiceGenerator) GeneratePDF(invoiceNumber string) (string, error) {
	if m.generateFunc != nil {
		return m.generateFunc(invoiceNumber)
	}
	return "generated://invoices/test.pdf", nil
}

type mockStripeClient struct {
	createPaymentFunc func(ctx context.Context, token string) (string, error)
}

func (m *mockStripeClient) CreatePaymentMethod(ctx context.Context, token string) (string, error) {
	if m.createPaymentFunc != nil {
		return m.createPaymentFunc(ctx, token)
	}
	return "pm_test_token", nil
}

// Helper to create a mock subscription
func createMockSubscription(userID uuid.UUID) *settings.Subscription {
	return &settings.Subscription{
		ID:                 uuid.New(),
		UserID:             userID,
		PlanID:             "pro",
		PlanName:           "Pro Plan",
		BillingCycle:       "monthly",
		Status:             "active",
		CurrentPeriodStart: time.Now().AddDate(0, 0, -30),
		CurrentPeriodEnd:   time.Now().AddDate(0, 0, 1),
		PaymentMethodID:    "pm_test_123",
		PaymentMethodType:  "card",
	}
}

// Helper to create a mock billing summary
func createMockBillingSummary(userID uuid.UUID) *settings.BillingSummary {
	return &settings.BillingSummary{
		Subscription: createMockSubscription(userID),
		Invoices: []settings.Invoice{
			{
				ID:            uuid.New(),
				UserID:        userID,
				InvoiceNumber: "INV-0001",
				Amount:        99.99,
				Currency:      "USD",
				TaxAmount:     10.00,
				TotalAmount:   109.99,
				Status:        "draft",
			},
		},
	}
}

// Test NewBillingWorker initialization with default interval
func TestNewBillingWorker(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	mockSvc := &mockSettingsService{}
	mockGen := &mockInvoiceGenerator{}
	mockStripe := &mockStripeClient{}

	worker := NewBillingWorker(mockSvc, nil, mockStripe, mockGen, 0, logger)

	if worker.interval != 5*time.Minute {
		t.Errorf("expected default interval 5m, got %v", worker.interval)
	}

	if worker.logger == nil {
		t.Error("expected logger to be initialized")
	}

	if worker.stripeClient == nil {
		t.Error("expected stripe client to be initialized")
	}

	if worker.invoiceGenerator == nil {
		t.Error("expected invoice generator to be initialized")
	}
}

// Test NewBillingWorker with custom interval
func TestNewBillingWorker_CustomInterval(t *testing.T) {
	customInterval := 2 * time.Minute
	logger := log.New(io.Discard, "", 0)
	mockSvc := &mockSettingsService{}

	worker := NewBillingWorker(mockSvc, nil, nil, nil, customInterval, logger)

	if worker.interval != customInterval {
		t.Errorf("expected interval %v, got %v", customInterval, worker.interval)
	}
}

// Test NewBillingWorker with nil logger
func TestNewBillingWorker_DefaultLogger(t *testing.T) {
	mockSvc := &mockSettingsService{}

	worker := NewBillingWorker(mockSvc, nil, nil, nil, 1*time.Minute, nil)

	if worker.logger == nil {
		t.Error("expected default logger to be created")
	}
}

// Test Run with nil context
func TestRun_NilContext(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	mockSvc := &mockSettingsService{}

	worker := NewBillingWorker(mockSvc, nil, nil, nil, 1*time.Minute, logger)

	err := worker.Run(nil)
	if err == nil {
		t.Error("expected error for nil context, got nil")
	}
}

// Test Run with context cancellation
func TestRun_ContextCancellation(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	mockSvc := &mockSettingsService{}

	worker := NewBillingWorker(mockSvc, nil, nil, nil, 10*time.Millisecond, logger)

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	start := time.Now()
	err := worker.Run(ctx)
	elapsed := time.Since(start)

	if err != context.Canceled && err != context.DeadlineExceeded {
		t.Errorf("expected context cancellation error, got %v", err)
	}

	if elapsed > 500*time.Millisecond {
		t.Errorf("worker took too long to halt: %v", elapsed)
	}
}

// Test isSubscriptionDue
func TestIsSubscriptionDue(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	mockSvc := &mockSettingsService{}

	worker := NewBillingWorker(mockSvc, nil, nil, nil, 1*time.Minute, logger)

	// Test subscription already due (past end date)
	pastDate := time.Now().AddDate(0, 0, -1)
	if !worker.isSubscriptionDue(pastDate) {
		t.Error("expected subscription to be due for past date")
	}

	// Test subscription not yet due (future end date)
	futureDate := time.Now().AddDate(0, 0, 1)
	if worker.isSubscriptionDue(futureDate) {
		t.Error("expected subscription to not be due for future date")
	}
}

// Test calculatePlanAmount
func TestCalculatePlanAmount(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	mockSvc := &mockSettingsService{}

	worker := NewBillingWorker(mockSvc, nil, nil, nil, 1*time.Minute, logger)

	tests := []struct {
		planID    string
		expectAmt float64
		expectTax float64
	}{
		{"free", 0.00, 0.00},
		{"basic", 29.99, 2.999},
		{"pro", 99.99, 9.999},
		{"enterprise", 299.99, 29.999},
		{"unknown", 29.99, 2.999}, // Defaults to basic
	}

	for _, tt := range tests {
		amt, tax := worker.calculatePlanAmount(tt.planID)
		if amt != tt.expectAmt {
			t.Errorf("plan %s: expected amount %.2f, got %.2f", tt.planID, tt.expectAmt, amt)
		}
		// Allow small floating point error
		if tax < tt.expectTax-0.01 || tax > tt.expectTax+0.01 {
			t.Errorf("plan %s: expected tax %.3f, got %.3f", tt.planID, tt.expectTax, tax)
		}
	}
}

// Test ProcessSubscriptionBilling with successful payment
func TestProcessSubscriptionBilling_Success(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	userID := uuid.New()

	mockSvc := &mockSettingsService{
		billingFunc: func(ctx context.Context, uid uuid.UUID) (*settings.BillingSummary, error) {
			if uid == userID {
				return createMockBillingSummary(userID), nil
			}
			return nil, errors.New("user not found")
		},
	}

	mockGen := &mockInvoiceGenerator{}
	mockStripe := &mockStripeClient{}

	worker := NewBillingWorker(mockSvc, nil, mockStripe, mockGen, 1*time.Minute, logger)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Make the subscription due
	mockSvc.billingFunc = func(ctx context.Context, uid uuid.UUID) (*settings.BillingSummary, error) {
		summary := createMockBillingSummary(userID)
		summary.Subscription.CurrentPeriodEnd = time.Now().AddDate(0, 0, -1) // Past due
		return summary, nil
	}

	err := worker.ProcessSubscriptionBilling(ctx, userID)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

// Test ProcessSubscriptionBilling with no subscription
func TestProcessSubscriptionBilling_NoSubscription(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	userID := uuid.New()

	mockSvc := &mockSettingsService{
		billingFunc: func(ctx context.Context, uid uuid.UUID) (*settings.BillingSummary, error) {
			return nil, nil // No subscription
		},
	}

	worker := NewBillingWorker(mockSvc, nil, nil, nil, 1*time.Minute, logger)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := worker.ProcessSubscriptionBilling(ctx, userID)
	if err != nil {
		t.Errorf("unexpected error for no subscription: %v", err)
	}
}

// Test ProcessSubscriptionBilling with subscription not due
func TestProcessSubscriptionBilling_NotDue(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	userID := uuid.New()

	mockSvc := &mockSettingsService{
		billingFunc: func(ctx context.Context, uid uuid.UUID) (*settings.BillingSummary, error) {
			summary := createMockBillingSummary(userID)
			summary.Subscription.CurrentPeriodEnd = time.Now().AddDate(0, 0, 30) // Future date
			return summary, nil
		},
	}

	worker := NewBillingWorker(mockSvc, nil, nil, nil, 1*time.Minute, logger)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := worker.ProcessSubscriptionBilling(ctx, userID)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

// Test ProcessSubscriptionBilling with failed billing retrieval
func TestProcessSubscriptionBilling_BillingError(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	userID := uuid.New()

	mockSvc := &mockSettingsService{
		billingFunc: func(ctx context.Context, uid uuid.UUID) (*settings.BillingSummary, error) {
			return nil, errors.New("database error")
		},
	}

	worker := NewBillingWorker(mockSvc, nil, nil, nil, 1*time.Minute, logger)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := worker.ProcessSubscriptionBilling(ctx, userID)
	if err == nil {
		t.Error("expected error, got nil")
	}
}

// Test generateInvoice
func TestGenerateInvoice(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	userID := uuid.New()
	mockSvc := &mockSettingsService{}
	mockGen := &mockInvoiceGenerator{}

	worker := NewBillingWorker(mockSvc, nil, nil, mockGen, 1*time.Minute, logger)

	billingSummary := createMockBillingSummary(userID)

	invoice, err := worker.generateInvoice(context.Background(), userID, billingSummary)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	if invoice == nil {
		t.Error("expected invoice, got nil")
	}

	if invoice.UserID != userID {
		t.Errorf("expected user ID %s, got %s", userID, invoice.UserID)
	}

	if invoice.Amount <= 0 {
		t.Errorf("expected positive amount, got %.2f", invoice.Amount)
	}

	if invoice.Status != "draft" {
		t.Errorf("expected draft status, got %s", invoice.Status)
	}

	if invoice.DueDate == nil {
		t.Error("expected due date, got nil")
	}
}

// Test applyDunningLogic state transitions
func TestApplyDunningLogic_StateTransitions(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	userID := uuid.New()
	mockSvc := &mockSettingsService{}

	worker := NewBillingWorker(mockSvc, nil, nil, nil, 1*time.Minute, logger)

	sub := createMockSubscription(userID)

	// Test transition from active to past_due
	sub.Status = "active"
	err := worker.applyDunningLogic(context.Background(), userID, sub)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	if sub.Status != "past_due" {
		t.Errorf("expected status to be past_due, got %s", sub.Status)
	}

	// Test transition from past_due to unpaid
	err = worker.applyDunningLogic(context.Background(), userID, sub)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	if sub.Status != "unpaid" {
		t.Errorf("expected status to be unpaid, got %s", sub.Status)
	}
}

// Test sendInvoiceNotification with no notification service
func TestSendInvoiceNotification_NoService(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	userID := uuid.New()
	mockSvc := &mockSettingsService{}

	// Create worker with nil notification service
	worker := NewBillingWorker(mockSvc, nil, nil, nil, 1*time.Minute, logger)

	invoice := &settings.Invoice{
		ID:            uuid.New(),
		UserID:        userID,
		InvoiceNumber: "INV-0001",
		Amount:        99.99,
	}

	err := worker.sendInvoiceNotification(context.Background(), userID, invoice)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}
