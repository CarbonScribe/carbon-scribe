package settings

import (
	"context"
	"testing"
	"time"

	settingsapi "carbon-scribe/project-portal/project-portal-backend/internal/settings/api"
	pkgbilling "carbon-scribe/project-portal/project-portal-backend/pkg/billing"
	"carbon-scribe/project-portal/project-portal-backend/pkg/encryption"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type fakeRepo struct {
	profiles      map[uuid.UUID]*UserProfile
	prefs         map[uuid.UUID]*NotificationPreference
	apiKeys       map[uuid.UUID]*APIKey
	integrations  map[uuid.UUID]*IntegrationConfiguration
	subscriptions map[uuid.UUID]*Subscription
	invoices      map[uuid.UUID]*Invoice
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		profiles:      map[uuid.UUID]*UserProfile{},
		prefs:         map[uuid.UUID]*NotificationPreference{},
		apiKeys:       map[uuid.UUID]*APIKey{},
		integrations:  map[uuid.UUID]*IntegrationConfiguration{},
		subscriptions: map[uuid.UUID]*Subscription{},
		invoices:      map[uuid.UUID]*Invoice{},
	}
}

func (r *fakeRepo) GetOrCreateProfile(_ context.Context, userID uuid.UUID) (*UserProfile, error) {
	if p, ok := r.profiles[userID]; ok {
		cp := *p
		return &cp, nil
	}
	p := &UserProfile{ID: uuid.New(), UserID: userID, Language: "en", Timezone: "UTC", Currency: "USD", DateFormat: "YYYY-MM-DD", VerificationLevel: "basic"}
	r.profiles[userID] = p
	cp := *p
	return &cp, nil
}
func (r *fakeRepo) SaveProfile(_ context.Context, profile *UserProfile) error {
	cp := *profile
	r.profiles[profile.UserID] = &cp
	return nil
}
func (r *fakeRepo) DeleteProfileData(_ context.Context, userID uuid.UUID) error {
	delete(r.profiles, userID)
	delete(r.prefs, userID)
	delete(r.subscriptions, userID)
	for id, k := range r.apiKeys {
		if k.UserID == userID {
			delete(r.apiKeys, id)
		}
	}
	for id, it := range r.integrations {
		if it.UserID == userID {
			delete(r.integrations, id)
		}
	}
	for id, inv := range r.invoices {
		if inv.UserID == userID {
			delete(r.invoices, id)
		}
	}
	return nil
}
func (r *fakeRepo) GetOrCreateNotificationPreferences(_ context.Context, userID uuid.UUID) (*NotificationPreference, error) {
	if p, ok := r.prefs[userID]; ok {
		cp := *p
		return &cp, nil
	}
	p := &NotificationPreference{ID: uuid.New(), UserID: userID, Categories: defaultNotificationCategories()}
	r.prefs[userID] = p
	cp := *p
	return &cp, nil
}
func (r *fakeRepo) SaveNotificationPreferences(_ context.Context, prefs *NotificationPreference) error {
	cp := *prefs
	r.prefs[prefs.UserID] = &cp
	return nil
}
func (r *fakeRepo) ListAPIKeys(_ context.Context, userID uuid.UUID) ([]APIKey, error) {
	out := []APIKey{}
	for _, k := range r.apiKeys {
		if k.UserID == userID {
			out = append(out, *k)
		}
	}
	return out, nil
}
func (r *fakeRepo) CreateAPIKey(_ context.Context, key *APIKey) error {
	cp := *key
	r.apiKeys[key.ID] = &cp
	return nil
}
func (r *fakeRepo) GetAPIKey(_ context.Context, userID, keyID uuid.UUID) (*APIKey, error) {
	k, ok := r.apiKeys[keyID]
	if !ok || k.UserID != userID {
		return nil, gorm.ErrRecordNotFound
	}
	cp := *k
	return &cp, nil
}
func (r *fakeRepo) ListAPIKeysByPrefix(_ context.Context, keyPrefix string) ([]APIKey, error) {
	out := []APIKey{}
	for _, k := range r.apiKeys {
		if k.KeyPrefix == keyPrefix {
			out = append(out, *k)
		}
	}
	return out, nil
}
func (r *fakeRepo) SaveAPIKey(_ context.Context, key *APIKey) error {
	cp := *key
	r.apiKeys[key.ID] = &cp
	return nil
}
func (r *fakeRepo) ListIntegrations(_ context.Context, userID uuid.UUID) ([]IntegrationConfiguration, error) {
	out := []IntegrationConfiguration{}
	for _, it := range r.integrations {
		if it.UserID == userID {
			out = append(out, *it)
		}
	}
	return out, nil
}
func (r *fakeRepo) GetIntegration(_ context.Context, userID, integrationID uuid.UUID) (*IntegrationConfiguration, error) {
	it, ok := r.integrations[integrationID]
	if !ok || it.UserID != userID {
		return nil, gorm.ErrRecordNotFound
	}
	cp := *it
	return &cp, nil
}
func (r *fakeRepo) UpsertIntegration(_ context.Context, integration *IntegrationConfiguration) error {
	for id, it := range r.integrations {
		if it.UserID == integration.UserID && it.IntegrationType == integration.IntegrationType && it.IntegrationName == integration.IntegrationName {
			cp := *integration
			cp.ID = id
			if cp.ID == uuid.Nil {
				cp.ID = uuid.New()
			}
			r.integrations[id] = &cp
			integration.ID = cp.ID
			return nil
		}
	}
	cp := *integration
	if cp.ID == uuid.Nil {
		cp.ID = uuid.New()
	}
	r.integrations[cp.ID] = &cp
	integration.ID = cp.ID
	return nil
}
func (r *fakeRepo) GetSubscription(_ context.Context, userID uuid.UUID) (*Subscription, error) {
	if s, ok := r.subscriptions[userID]; ok {
		cp := *s
		return &cp, nil
	}
	now := time.Now().UTC()
	s := &Subscription{ID: uuid.New(), UserID: userID, PlanID: "free", PlanName: "Free", BillingCycle: "monthly", Status: "active", CurrentPeriodStart: now, CurrentPeriodEnd: now.AddDate(0, 1, 0)}
	r.subscriptions[userID] = s
	cp := *s
	return &cp, nil
}
func (r *fakeRepo) SaveSubscription(_ context.Context, sub *Subscription) error {
	cp := *sub
	r.subscriptions[sub.UserID] = &cp
	return nil
}
func (r *fakeRepo) ListInvoices(_ context.Context, userID uuid.UUID, _ int) ([]Invoice, error) {
	out := []Invoice{}
	for _, inv := range r.invoices {
		if inv.UserID == userID {
			out = append(out, *inv)
		}
	}
	return out, nil
}
func (r *fakeRepo) GetInvoice(_ context.Context, userID, invoiceID uuid.UUID) (*Invoice, error) {
	inv, ok := r.invoices[invoiceID]
	if !ok || inv.UserID != userID {
		return nil, gorm.ErrRecordNotFound
	}
	cp := *inv
	return &cp, nil
}
func (r *fakeRepo) SaveInvoice(_ context.Context, invoice *Invoice) error {
	cp := *invoice
	r.invoices[invoice.ID] = &cp
	return nil
}

func newTestService(t *testing.T, repo *fakeRepo) *service {
	t.Helper()
	v, err := encryption.NewVault([]byte("0123456789abcdef0123456789abcdef"))
	if err != nil {
		t.Fatalf("vault init error: %v", err)
	}
	return &service{
		repo:             repo,
		vault:            v,
		invoiceGenerator: pkgbilling.NoopInvoiceGenerator{},
		cfg:              Config{APIKeyPrefix: "ppk_test", ProfileCDNBase: "https://cdn.example.test"},
		usageTracker:     settingsapi.NewKeyUsageTracker(),
		oauthStates:      map[string]oauthState{},
	}
}

func TestValidateAPIKeySecretTracksUsageAndRateLimits(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(t, repo)
	userID := uuid.New()
	secret := "ppk_test_abcdefghijklmnop"
	hash, err := bcrypt.GenerateFromPassword([]byte(secret), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash error: %v", err)
	}
	keyID := uuid.New()
	repo.apiKeys[keyID] = &APIKey{
		ID:                 keyID,
		UserID:             userID,
		Name:               "test",
		KeyPrefix:          secret[:8],
		KeyHash:            string(hash),
		KeyLastFour:        secret[len(secret)-4:],
		Scopes:             pq.StringArray{"settings:read"},
		RateLimitPerMinute: 1,
		RateLimitPerDay:    10,
		IsActive:           true,
		Metadata:           datatypes.JSONMap{},
	}

	resp, err := svc.ValidateAPIKeySecret(context.Background(), ValidateAPIKeyRequest{Secret: secret})
	if err != nil {
		t.Fatalf("ValidateAPIKeySecret error: %v", err)
	}
	if !resp.Valid || resp.Key == nil || resp.Usage == nil {
		t.Fatalf("expected valid response with key and usage")
	}

	resp2, err := svc.ValidateAPIKeySecret(context.Background(), ValidateAPIKeyRequest{Secret: secret})
	if err != nil {
		t.Fatalf("ValidateAPIKeySecret second call error: %v", err)
	}
	if resp2.Valid || !resp2.RateLimited {
		t.Fatalf("expected rate limited second response")
	}
	if resp2.RetryAfterSec <= 0 {
		t.Fatalf("expected retry_after on rate-limited response")
	}
}

func TestOAuthFlowRoundTripCreatesIntegration(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(t, repo)
	userID := uuid.New()

	start, err := svc.StartOAuthFlow(context.Background(), userID, "stripe")
	if err != nil {
		t.Fatalf("StartOAuthFlow error: %v", err)
	}
	if start.State == "" || start.RedirectURL == "" {
		t.Fatalf("expected state and redirect url")
	}

	callback, err := svc.CompleteOAuthFlow(context.Background(), userID, "stripe", OAuthCallbackRequest{
		State:           start.State,
		Code:            "auth-code-123",
		IntegrationName: "payments",
	})
	if err != nil {
		t.Fatalf("CompleteOAuthFlow error: %v", err)
	}
	if !callback.Connected || callback.Integration == nil {
		t.Fatalf("expected connected integration")
	}
}

func TestDeleteProfileErasesSettingsData(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(t, repo)
	userID := uuid.New()
	repo.profiles[userID] = &UserProfile{ID: uuid.New(), UserID: userID}
	repo.prefs[userID] = &NotificationPreference{ID: uuid.New(), UserID: userID}
	repo.apiKeys[uuid.New()] = &APIKey{ID: uuid.New(), UserID: userID}

	_, err := svc.DeleteProfile(context.Background(), userID)
	if err != nil {
		t.Fatalf("DeleteProfile error: %v", err)
	}
	if _, ok := repo.profiles[userID]; ok {
		t.Fatalf("expected profile deleted")
	}
	if _, ok := repo.prefs[userID]; ok {
		t.Fatalf("expected prefs deleted")
	}
	if len(repo.apiKeys) != 0 {
		t.Fatalf("expected api keys deleted")
	}
}

func TestGetInvoicePDFGeneratesURLWhenMissing(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(t, repo)
	userID := uuid.New()
	invoiceID := uuid.New()
	repo.invoices[invoiceID] = &Invoice{
		ID:            invoiceID,
		UserID:        userID,
		InvoiceNumber: "INV-2026-0001",
		Status:        "open",
	}

	resp, err := svc.GetInvoicePDF(context.Background(), userID, invoiceID)
	if err != nil {
		t.Fatalf("GetInvoicePDF error: %v", err)
	}
	if resp.PDFURL == "" {
		t.Fatalf("expected generated PDF URL")
	}
}

func TestCompleteOAuthFlowRejectsUnknownState(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(t, repo)
	_, err := svc.CompleteOAuthFlow(context.Background(), uuid.New(), "stripe", OAuthCallbackRequest{
		State: "missing",
		Code:  "code",
	})
	if err == nil {
		t.Fatalf("expected error for unknown oauth state")
	}
}
