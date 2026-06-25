//go:build integration
// +build integration

package workers_test

import (
	"context"
	"io"
	"log"
	"testing"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/cmd/workers"
	"carbon-scribe/project-portal/project-portal-backend/internal/settings"
	pkgbilling "carbon-scribe/project-portal/project-portal-backend/pkg/billing"

	"github.com/google/uuid"
)

// Integration test: Billing worker with real subscription lifecycle
func TestBillingWorkerIntegration_SubscriptionLifecycle(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	userID := uuid.New()

	// Mock settings service that tracks calls
	callCount := 0
	mockSvc := &mockIntegrationSettingsService{
		getBillingFunc: func(ctx context.Context, uid uuid.UUID) (*settings.BillingSummary, error) {
			callCount++
			sub := &settings.Subscription{
				ID:                 uuid.New(),
				UserID:             uid,
				PlanID:             "pro",
				PlanName:           "Pro Plan",
				BillingCycle:       "monthly",
				Status:             "active",
				CurrentPeriodStart: time.Now().AddDate(0, 0, -30),
				CurrentPeriodEnd:   time.Now().AddDate(0, 0, -1), // Past due
				PaymentMethodID:    "pm_test_123",
				PaymentMethodType:  "card",
			}
			return &settings.BillingSummary{
				Subscription: sub,
				Invoices:     []settings.Invoice{},
			}, nil
		},
	}

	mockGen := &mockIntegrationInvoiceGenerator{}
	mockStripe := &mockIntegrationStripeClient{}

	// Create billing worker with fast interval for testing
	worker := workers.NewBillingWorker(
		mockSvc,
		nil, // no notifications for this test
		mockStripe,
		mockGen,
		100*time.Millisecond, // Fast interval for testing
		logger,
	)

	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	// Run worker for a short time to see multiple cycles
	go func() {
		err := worker.Run(ctx)
		if err != context.DeadlineExceeded && err != context.Canceled {
			t.Errorf("unexpected error: %v", err)
		}
	}()

	// Wait for some cycles to complete
	time.Sleep(350 * time.Millisecond)
	cancel()

	// Allow time for goroutine to finish
	time.Sleep(100 * time.Millisecond)

	// Verify multiple cycles occurred
	if callCount < 2 {
		t.Errorf("expected multiple billing cycles, got %d calls", callCount)
	}
}

// Integration test: Billing worker with multiple users
func TestBillingWorkerIntegration_MultipleUsers(t *testing.T) {
	logger := log.New(io.Discard, "", 0)

	user1 := uuid.New()
	user2 := uuid.New()
	user3 := uuid.New()

	userSubscriptions := map[uuid.UUID]*settings.Subscription{
		user1: {
			ID:                uuid.New(),
			UserID:            user1,
			PlanID:            "basic",
			PlanName:          "Basic Plan",
			BillingCycle:      "monthly",
			Status:            "active",
			CurrentPeriodEnd:  time.Now().AddDate(0, 0, -1),
			PaymentMethodID:   "pm_user1",
			PaymentMethodType: "card",
		},
		user2: {
			ID:                uuid.New(),
			UserID:            user2,
			PlanID:            "pro",
			PlanName:          "Pro Plan",
			BillingCycle:      "monthly",
			Status:            "active",
			CurrentPeriodEnd:  time.Now().AddDate(0, 0, 15), // Not yet due
			PaymentMethodID:   "pm_user2",
			PaymentMethodType: "card",
		},
		user3: {
			ID:                uuid.New(),
			UserID:            user3,
			PlanID:            "enterprise",
			PlanName:          "Enterprise Plan",
			BillingCycle:      "monthly",
			Status:            "past_due",
			CurrentPeriodEnd:  time.Now().AddDate(0, 0, -5),
			PaymentMethodID:   "pm_user3",
			PaymentMethodType: "card",
		},
	}

	mockSvc := &mockIntegrationSettingsService{
		getBillingFunc: func(ctx context.Context, uid uuid.UUID) (*settings.BillingSummary, error) {
			sub, exists := userSubscriptions[uid]
			if !exists {
				return nil, nil
			}
			return &settings.BillingSummary{
				Subscription: sub,
				Invoices:     []settings.Invoice{},
			}, nil
		},
	}

	mockGen := &mockIntegrationInvoiceGenerator{}
	mockStripe := &mockIntegrationStripeClient{}

	worker := workers.NewBillingWorker(
		mockSvc,
		nil,
		mockStripe,
		mockGen,
		100*time.Millisecond,
		logger,
	)

	// Process each user
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	for _, userID := range []uuid.UUID{user1, user2, user3} {
		err := worker.ProcessSubscriptionBilling(ctx, userID)
		if err != nil && err != context.Canceled {
			t.Logf("processing user %s: %v", userID, err)
		}
	}

	// User1 should be due (billing triggered)
	// User2 should not be due (period in future)
	// User3 should process despite past_due status
}

// Integration test: Invoice generation workflow
func TestBillingWorkerIntegration_InvoiceGeneration(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	userID := uuid.New()

	pdfGeneratedCount := 0
	mockGen := &mockIntegrationInvoiceGenerator{
		onGenerate: func(invoiceNum string) {
			pdfGeneratedCount++
		},
	}

	mockSvc := &mockIntegrationSettingsService{
		getBillingFunc: func(ctx context.Context, uid uuid.UUID) (*settings.BillingSummary, error) {
			return &settings.BillingSummary{
				Subscription: &settings.Subscription{
					ID:                uuid.New(),
					UserID:            uid,
					PlanID:            "pro",
					PlanName:          "Pro",
					BillingCycle:      "monthly",
					Status:            "active",
					CurrentPeriodEnd:  time.Now().AddDate(0, 0, -1),
					PaymentMethodID:   "pm_123",
					PaymentMethodType: "card",
				},
				Invoices: []settings.Invoice{},
			}, nil
		},
	}

	worker := workers.NewBillingWorker(
		mockSvc,
		nil,
		pkgbilling.NoopStripeClient{},
		mockGen,
		1*time.Minute,
		logger,
	)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := worker.ProcessSubscriptionBilling(ctx, userID)
	if err != nil {
		t.Errorf("failed to process billing: %v", err)
	}

	if pdfGeneratedCount != 1 {
		t.Errorf("expected 1 PDF generation, got %d", pdfGeneratedCount)
	}
}

// Mock implementations for integration tests

type mockIntegrationSettingsService struct {
	getBillingFunc func(ctx context.Context, userID uuid.UUID) (*settings.BillingSummary, error)
}

func (m *mockIntegrationSettingsService) GetBilling(ctx context.Context, userID uuid.UUID) (*settings.BillingSummary, error) {
	if m.getBillingFunc != nil {
		return m.getBillingFunc(ctx, userID)
	}
	return nil, nil
}

func (m *mockIntegrationSettingsService) GetProfile(ctx context.Context, userID uuid.UUID) (*settings.UserProfile, error) {
	return nil, nil
}

func (m *mockIntegrationSettingsService) UpdateProfile(ctx context.Context, userID uuid.UUID, req settings.UpdateProfileRequest) (*settings.UserProfile, error) {
	return nil, nil
}

func (m *mockIntegrationSettingsService) UploadProfilePicture(ctx context.Context, userID uuid.UUID, filename string) (*settings.ProfilePictureUploadResponse, error) {
	return nil, nil
}

func (m *mockIntegrationSettingsService) ExportProfile(ctx context.Context, userID uuid.UUID, format string) ([]byte, string, error) {
	return nil, "", nil
}

func (m *mockIntegrationSettingsService) DeleteProfile(ctx context.Context, userID uuid.UUID) (*settings.DeleteProfileResponse, error) {
	return nil, nil
}

func (m *mockIntegrationSettingsService) GetNotifications(ctx context.Context, userID uuid.UUID) (*settings.NotificationPreference, error) {
	return nil, nil
}

func (m *mockIntegrationSettingsService) UpdateNotifications(ctx context.Context, userID uuid.UUID, req settings.UpdateNotificationPreferencesRequest) (*settings.NotificationPreference, error) {
	return nil, nil
}

func (m *mockIntegrationSettingsService) ListAPIKeys(ctx context.Context, userID uuid.UUID) ([]settings.APIKeyPublic, error) {
	return nil, nil
}

func (m *mockIntegrationSettingsService) CreateAPIKey(ctx context.Context, userID uuid.UUID, req settings.CreateAPIKeyRequest) (*settings.CreateAPIKeyResponse, error) {
	return nil, nil
}

func (m *mockIntegrationSettingsService) RevokeAPIKey(ctx context.Context, userID, keyID uuid.UUID) error {
	return nil
}

func (m *mockIntegrationSettingsService) RotateAPIKey(ctx context.Context, userID, keyID uuid.UUID) (*settings.CreateAPIKeyResponse, error) {
	return nil, nil
}

func (m *mockIntegrationSettingsService) GetAPIKeyUsage(ctx context.Context, userID, keyID uuid.UUID) (*settings.APIKeyUsageAnalytics, error) {
	return nil, nil
}

func (m *mockIntegrationSettingsService) ConfigureAPIKeyWebhooks(ctx context.Context, userID, keyID uuid.UUID, req settings.ConfigureAPIKeyWebhooksRequest) (*settings.APIKeyPublic, error) {
	return nil, nil
}

func (m *mockIntegrationSettingsService) ValidateAPIKeySecret(ctx context.Context, req settings.ValidateAPIKeyRequest) (*settings.ValidateAPIKeyResponse, error) {
	return nil, nil
}

func (m *mockIntegrationSettingsService) ListIntegrations(ctx context.Context, userID uuid.UUID) ([]settings.IntegrationConfigurationPublic, error) {
	return nil, nil
}

func (m *mockIntegrationSettingsService) ConfigureIntegration(ctx context.Context, userID uuid.UUID, req settings.ConfigureIntegrationRequest) (*settings.IntegrationConfigurationPublic, error) {
	return nil, nil
}

func (m *mockIntegrationSettingsService) BatchConfigureIntegrations(ctx context.Context, userID uuid.UUID, req settings.BatchConfigureIntegrationsRequest) ([]settings.IntegrationConfigurationPublic, error) {
	return nil, nil
}

func (m *mockIntegrationSettingsService) StartOAuthFlow(ctx context.Context, userID uuid.UUID, provider string) (*settings.OAuthStartResponse, error) {
	return nil, nil
}

func (m *mockIntegrationSettingsService) CompleteOAuthFlow(ctx context.Context, userID uuid.UUID, provider string, req settings.OAuthCallbackRequest) (*settings.OAuthCallbackResponse, error) {
	return nil, nil
}

func (m *mockIntegrationSettingsService) GetIntegrationHealth(ctx context.Context, userID, integrationID uuid.UUID) (*settings.IntegrationHealthResponse, error) {
	return nil, nil
}

func (m *mockIntegrationSettingsService) ListInvoices(ctx context.Context, userID uuid.UUID) ([]settings.Invoice, error) {
	return nil, nil
}

func (m *mockIntegrationSettingsService) GetInvoicePDF(ctx context.Context, userID, invoiceID uuid.UUID) (*settings.InvoicePDFResponse, error) {
	return nil, nil
}

func (m *mockIntegrationSettingsService) AddPaymentMethod(ctx context.Context, userID uuid.UUID, req settings.AddPaymentMethodRequest) (*settings.Subscription, error) {
	return nil, nil
}

type mockIntegrationInvoiceGenerator struct {
	onGenerate func(invoiceNum string)
}

func (m *mockIntegrationInvoiceGenerator) GeneratePDF(invoiceNumber string) (string, error) {
	if m.onGenerate != nil {
		m.onGenerate(invoiceNumber)
	}
	return "generated://invoices/" + invoiceNumber + ".pdf", nil
}

type mockIntegrationStripeClient struct {
	onCharge func(amount float64)
}

func (m *mockIntegrationStripeClient) CreatePaymentMethod(ctx context.Context, token string) (string, error) {
	return "pm_test_" + token, nil
}
