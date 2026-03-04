package settings

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	settingsapi "carbon-scribe/project-portal/project-portal-backend/internal/settings/api"
	settingsbilling "carbon-scribe/project-portal/project-portal-backend/internal/settings/billing"
	settingsintegrations "carbon-scribe/project-portal/project-portal-backend/internal/settings/integrations"
	settingsnotifications "carbon-scribe/project-portal/project-portal-backend/internal/settings/notifications"
	settingsprofile "carbon-scribe/project-portal/project-portal-backend/internal/settings/profile"
	pkgbilling "carbon-scribe/project-portal/project-portal-backend/pkg/billing"
	"carbon-scribe/project-portal/project-portal-backend/pkg/encryption"
	v "carbon-scribe/project-portal/project-portal-backend/pkg/validation"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/datatypes"
)

type Config struct {
	EncryptionKeyHex string
	APIKeyPrefix     string
	ProfileCDNBase   string
}

type Service interface {
	GetProfile(ctx context.Context, userID uuid.UUID) (*UserProfile, error)
	UpdateProfile(ctx context.Context, userID uuid.UUID, req UpdateProfileRequest) (*UserProfile, error)
	UploadProfilePicture(ctx context.Context, userID uuid.UUID, filename string) (*ProfilePictureUploadResponse, error)
	ExportProfile(ctx context.Context, userID uuid.UUID, format string) ([]byte, string, error)
	DeleteProfile(ctx context.Context, userID uuid.UUID) (*DeleteProfileResponse, error)
	GetNotifications(ctx context.Context, userID uuid.UUID) (*NotificationPreference, error)
	UpdateNotifications(ctx context.Context, userID uuid.UUID, req UpdateNotificationPreferencesRequest) (*NotificationPreference, error)
	ListAPIKeys(ctx context.Context, userID uuid.UUID) ([]APIKeyPublic, error)
	CreateAPIKey(ctx context.Context, userID uuid.UUID, req CreateAPIKeyRequest) (*CreateAPIKeyResponse, error)
	RevokeAPIKey(ctx context.Context, userID, keyID uuid.UUID) error
	RotateAPIKey(ctx context.Context, userID, keyID uuid.UUID) (*CreateAPIKeyResponse, error)
	GetAPIKeyUsage(ctx context.Context, userID, keyID uuid.UUID) (*APIKeyUsageAnalytics, error)
	ConfigureAPIKeyWebhooks(ctx context.Context, userID, keyID uuid.UUID, req ConfigureAPIKeyWebhooksRequest) (*APIKeyPublic, error)
	ValidateAPIKeySecret(ctx context.Context, req ValidateAPIKeyRequest) (*ValidateAPIKeyResponse, error)
	ListIntegrations(ctx context.Context, userID uuid.UUID) ([]IntegrationConfigurationPublic, error)
	ConfigureIntegration(ctx context.Context, userID uuid.UUID, req ConfigureIntegrationRequest) (*IntegrationConfigurationPublic, error)
	BatchConfigureIntegrations(ctx context.Context, userID uuid.UUID, req BatchConfigureIntegrationsRequest) ([]IntegrationConfigurationPublic, error)
	StartOAuthFlow(ctx context.Context, userID uuid.UUID, provider string) (*OAuthStartResponse, error)
	CompleteOAuthFlow(ctx context.Context, userID uuid.UUID, provider string, req OAuthCallbackRequest) (*OAuthCallbackResponse, error)
	GetIntegrationHealth(ctx context.Context, userID, integrationID uuid.UUID) (*IntegrationHealthResponse, error)
	GetBilling(ctx context.Context, userID uuid.UUID) (*BillingSummary, error)
	ListInvoices(ctx context.Context, userID uuid.UUID) ([]Invoice, error)
	GetInvoicePDF(ctx context.Context, userID, invoiceID uuid.UUID) (*InvoicePDFResponse, error)
	AddPaymentMethod(ctx context.Context, userID uuid.UUID, req AddPaymentMethodRequest) (*Subscription, error)
}

type service struct {
	repo             Repository
	vault            *encryption.Vault
	invoiceGenerator pkgbilling.InvoiceGenerator
	cfg              Config
	usageTracker     *settingsapi.KeyUsageTracker
	oauthMu          sync.Mutex
	oauthStates      map[string]oauthState
}

type oauthState struct {
	UserID    uuid.UUID
	Provider  string
	ExpiresAt time.Time
	CreatedAt time.Time
}

func NewService(repo Repository, cfg Config) (Service, error) {
	key, err := decodeEncryptionKey(cfg.EncryptionKeyHex)
	if err != nil {
		return nil, err
	}
	vault, err := encryption.NewVault(key)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(cfg.APIKeyPrefix) == "" {
		cfg.APIKeyPrefix = "ppk_live"
	}
	if strings.TrimSpace(cfg.ProfileCDNBase) == "" {
		cfg.ProfileCDNBase = "https://cdn.carbonscribe.local"
	}
	return &service{
		repo:             repo,
		vault:            vault,
		invoiceGenerator: pkgbilling.NoopInvoiceGenerator{},
		cfg:              cfg,
		usageTracker:     settingsapi.NewKeyUsageTracker(),
		oauthStates:      map[string]oauthState{},
	}, nil
}

func decodeEncryptionKey(hexKey string) ([]byte, error) {
	trimmed := strings.TrimSpace(hexKey)
	if trimmed == "" {
		// deterministic local default (32 bytes, dev-only fallback)
		return []byte("settings-dev-encryption-key-32!!"), nil
	}
	b, err := hex.DecodeString(trimmed)
	if err != nil {
		return nil, fmt.Errorf("invalid SETTINGS_ENCRYPTION_KEY_HEX: %w", err)
	}
	return b, nil
}

func (s *service) GetProfile(ctx context.Context, userID uuid.UUID) (*UserProfile, error) {
	return s.repo.GetOrCreateProfile(ctx, userID)
}

func (s *service) UpdateProfile(ctx context.Context, userID uuid.UUID, req UpdateProfileRequest) (*UserProfile, error) {
	if err := settingsprofile.ValidateContactInfo(req.SecondaryEmail, req.PhoneNumber, req.Website); err != nil {
		return nil, err
	}
	if err := settingsprofile.ValidateAddress(req.Address); err != nil {
		return nil, err
	}
	if req.Language != "" && len(req.Language) > 10 {
		return nil, fmt.Errorf("language too long")
	}
	if req.Currency != "" && len(req.Currency) != 3 {
		return nil, fmt.Errorf("currency must be 3-letter ISO code")
	}

	profile, err := s.repo.GetOrCreateProfile(ctx, userID)
	if err != nil {
		return nil, err
	}
	before := *profile

	if req.FullName != "" || req.DisplayName != "" {
		profile.FullName = strings.TrimSpace(req.FullName)
		profile.DisplayName = settingsprofile.NormalizeDisplayName(req.FullName, req.DisplayName)
	}
	if req.Bio != "" {
		profile.Bio = req.Bio
	}
	if req.PhoneNumber != "" {
		profile.PhoneNumber = req.PhoneNumber
	}
	if req.SecondaryEmail != "" {
		profile.SecondaryEmail = req.SecondaryEmail
	}
	if req.Address != nil {
		profile.Address = datatypes.JSONMap(req.Address)
	}
	if req.Organization != "" {
		profile.Organization = req.Organization
	}
	if req.JobTitle != "" {
		profile.JobTitle = req.JobTitle
	}
	if req.Website != "" {
		profile.Website = req.Website
	}
	if req.Language != "" {
		profile.Language = req.Language
	}
	if req.Timezone != "" {
		profile.Timezone = req.Timezone
	}
	if req.Currency != "" {
		profile.Currency = strings.ToUpper(req.Currency)
	}
	if req.DateFormat != "" {
		profile.DateFormat = req.DateFormat
	}

	if err := s.repo.SaveProfile(ctx, profile); err != nil {
		return nil, err
	}
	s.audit("profile.update", userID, map[string]interface{}{"before": before, "after": profile})
	return profile, nil
}

func (s *service) UploadProfilePicture(ctx context.Context, userID uuid.UUID, filename string) (*ProfilePictureUploadResponse, error) {
	profile, err := s.repo.GetOrCreateProfile(ctx, userID)
	if err != nil {
		return nil, err
	}
	url := settingsprofile.BuildProfilePictureURL(s.cfg.ProfileCDNBase, userID, filename)
	profile.ProfilePictureURL = url
	if err := s.repo.SaveProfile(ctx, profile); err != nil {
		return nil, err
	}
	s.audit("profile.picture.upload", userID, map[string]interface{}{"filename": filename})
	return &ProfilePictureUploadResponse{ProfilePictureURL: url, Message: "profile picture updated"}, nil
}

func (s *service) ExportProfile(ctx context.Context, userID uuid.UUID, format string) ([]byte, string, error) {
	profile, err := s.repo.GetOrCreateProfile(ctx, userID)
	if err != nil {
		return nil, "", err
	}
	prefs, err := s.repo.GetOrCreateNotificationPreferences(ctx, userID)
	if err != nil {
		return nil, "", err
	}
	payload := map[string]interface{}{
		"profile":       profile,
		"notifications": prefs,
	}
	if strings.EqualFold(format, "pdf") {
		s.audit("profile.export.pdf", userID, nil)
		return settingsprofile.ExportPDFPlaceholder(), "application/pdf", nil
	}
	b, err := settingsprofile.ExportJSON(payload)
	if err != nil {
		return nil, "", err
	}
	s.audit("profile.export.json", userID, nil)
	return b, "application/json", nil
}

func (s *service) DeleteProfile(ctx context.Context, userID uuid.UUID) (*DeleteProfileResponse, error) {
	beforeProfile, _ := s.repo.GetOrCreateProfile(ctx, userID)
	beforeNotifications, _ := s.repo.GetOrCreateNotificationPreferences(ctx, userID)
	if err := s.repo.DeleteProfileData(ctx, userID); err != nil {
		return nil, err
	}
	s.audit("profile.delete", userID, map[string]interface{}{
		"before": map[string]interface{}{
			"profile":       beforeProfile,
			"notifications": beforeNotifications,
		},
		"after": "erased",
	})
	return &DeleteProfileResponse{Message: "profile and settings data erased"}, nil
}

func (s *service) GetNotifications(ctx context.Context, userID uuid.UUID) (*NotificationPreference, error) {
	return s.repo.GetOrCreateNotificationPreferences(ctx, userID)
}

func (s *service) UpdateNotifications(ctx context.Context, userID uuid.UUID, req UpdateNotificationPreferencesRequest) (*NotificationPreference, error) {
	if err := settingsnotifications.ValidateQuietHours(req.QuietHoursStart, req.QuietHoursEnd); err != nil {
		return nil, err
	}
	prefs, err := s.repo.GetOrCreateNotificationPreferences(ctx, userID)
	if err != nil {
		return nil, err
	}
	before := *prefs
	prefs.EmailEnabled = settingsnotifications.MergeChannelPreference(prefs.EmailEnabled, req.EmailEnabled)
	prefs.SMSSEnabled = settingsnotifications.MergeChannelPreference(prefs.SMSSEnabled, req.SMSEnabled)
	prefs.PushEnabled = settingsnotifications.MergeChannelPreference(prefs.PushEnabled, req.PushEnabled)
	prefs.InAppEnabled = settingsnotifications.MergeChannelPreference(prefs.InAppEnabled, req.InAppEnabled)
	prefs.QuietHoursEnabled = settingsnotifications.MergeChannelPreference(prefs.QuietHoursEnabled, req.QuietHoursEnabled)
	prefs.EmergencyOverride = settingsnotifications.MergeChannelPreference(prefs.EmergencyOverride, req.EmergencyOverride)
	if req.Categories != nil {
		prefs.Categories = settingsnotifications.MergeWithInheritance(req.Categories)
	}
	if req.QuietHoursStart != "" {
		prefs.QuietHoursStart = req.QuietHoursStart
	}
	if req.QuietHoursEnd != "" {
		prefs.QuietHoursEnd = req.QuietHoursEnd
	}
	if req.QuietHoursTimezone != "" {
		prefs.QuietHoursTimezone = req.QuietHoursTimezone
	}
	if req.EmergencySeverityLevel != "" {
		prefs.EmergencySeverityLevel = req.EmergencySeverityLevel
	}
	if err := s.repo.SaveNotificationPreferences(ctx, prefs); err != nil {
		return nil, err
	}
	s.audit("notifications.update", userID, map[string]interface{}{"before": before, "after": prefs})
	return prefs, nil
}

func (s *service) ListAPIKeys(ctx context.Context, userID uuid.UUID) ([]APIKeyPublic, error) {
	keys, err := s.repo.ListAPIKeys(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]APIKeyPublic, 0, len(keys))
	for _, k := range keys {
		out = append(out, toAPIKeyPublic(k))
	}
	return out, nil
}

func (s *service) CreateAPIKey(ctx context.Context, userID uuid.UUID, req CreateAPIKeyRequest) (*CreateAPIKeyResponse, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, fmt.Errorf("name is required")
	}
	if err := settingsapi.ValidateScopes(req.Scopes); err != nil {
		return nil, err
	}
	if req.RateLimitPerMinute <= 0 {
		req.RateLimitPerMinute = 60
	}
	if req.RateLimitPerDay <= 0 {
		req.RateLimitPerDay = 1000
	}
	secret, prefix, last4, err := settingsapi.GenerateSecret(s.cfg.APIKeyPrefix)
	if err != nil {
		return nil, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(secret), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	key := &APIKey{
		ID:                 uuid.New(),
		UserID:             userID,
		Name:               req.Name,
		KeyPrefix:          prefix,
		KeyHash:            string(hash),
		KeyLastFour:        last4,
		Scopes:             pq.StringArray(req.Scopes),
		RateLimitPerMinute: req.RateLimitPerMinute,
		RateLimitPerDay:    req.RateLimitPerDay,
		ExpiresAt:          req.ExpiresAt,
		IsActive:           true,
		Metadata:           datatypes.JSONMap(req.Metadata),
	}
	if key.Metadata == nil {
		key.Metadata = datatypes.JSONMap{}
	}
	key.Metadata["usage_total"] = 0
	key.Metadata["usage_today"] = 0
	key.Metadata["usage_day"] = time.Now().UTC().Format("2006-01-02")
	key.Metadata["webhooks"] = []APIKeyWebhookSubscription{}
	if err := s.repo.CreateAPIKey(ctx, key); err != nil {
		return nil, err
	}
	s.audit("api_key.create", userID, map[string]interface{}{"after": key})
	return &CreateAPIKeyResponse{APIKey: toAPIKeyPublic(*key), Secret: secret, Message: "Store this key now. It will not be shown again."}, nil
}

func (s *service) RevokeAPIKey(ctx context.Context, userID, keyID uuid.UUID) error {
	key, err := s.repo.GetAPIKey(ctx, userID, keyID)
	if err != nil {
		return err
	}
	before := *key
	key.IsActive = false
	if key.Metadata == nil {
		key.Metadata = datatypes.JSONMap{}
	}
	key.Metadata["revoked_at"] = time.Now().UTC().Format(time.RFC3339)
	if err := s.repo.SaveAPIKey(ctx, key); err != nil {
		return err
	}
	s.audit("api_key.revoke", userID, map[string]interface{}{"before": before, "after": key})
	return nil
}

func (s *service) RotateAPIKey(ctx context.Context, userID, keyID uuid.UUID) (*CreateAPIKeyResponse, error) {
	key, err := s.repo.GetAPIKey(ctx, userID, keyID)
	if err != nil {
		return nil, err
	}
	before := *key
	secret, prefix, last4, err := settingsapi.GenerateSecret(s.cfg.APIKeyPrefix)
	if err != nil {
		return nil, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(secret), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	key.KeyHash = string(hash)
	key.KeyPrefix = prefix
	key.KeyLastFour = last4
	if key.Metadata == nil {
		key.Metadata = datatypes.JSONMap{}
	}
	key.Metadata["rotation_grace_period_until"] = time.Now().UTC().Add(24 * time.Hour).Format(time.RFC3339)
	key.Metadata["last_rotated_at"] = time.Now().UTC().Format(time.RFC3339)
	if err := s.repo.SaveAPIKey(ctx, key); err != nil {
		return nil, err
	}
	s.audit("api_key.rotate", userID, map[string]interface{}{"before": before, "after": key})
	return &CreateAPIKeyResponse{APIKey: toAPIKeyPublic(*key), Secret: secret, Message: "API key rotated. Grace period metadata recorded for migration."}, nil
}

func (s *service) GetAPIKeyUsage(ctx context.Context, userID, keyID uuid.UUID) (*APIKeyUsageAnalytics, error) {
	key, err := s.repo.GetAPIKey(ctx, userID, keyID)
	if err != nil {
		return nil, err
	}
	analytics := &APIKeyUsageAnalytics{
		KeyID:              key.ID,
		LastUsedAt:         key.LastUsedAt,
		RateLimitPerMinute: key.RateLimitPerMinute,
		RateLimitPerDay:    key.RateLimitPerDay,
	}
	if key.Metadata != nil {
		analytics.RequestCountTotal = int64(jsonNumberToInt(key.Metadata["usage_total"]))
		usageDay := stringValue(key.Metadata["usage_day"])
		if usageDay == time.Now().UTC().Format("2006-01-02") {
			analytics.RequestCountToday = int64(jsonNumberToInt(key.Metadata["usage_today"]))
		}
		if ts, ok := parseMetadataTime(key.Metadata["last_rate_limit_exceeded_at"]); ok {
			analytics.LastRateLimitExceeded = &ts
		}
	}
	if minuteCount, dayCount, ok := s.usageTracker.Snapshot(key.ID); ok {
		analytics.RequestCountToday = int64(dayCount)
		_ = minuteCount
	}
	return analytics, nil
}

func (s *service) ConfigureAPIKeyWebhooks(ctx context.Context, userID, keyID uuid.UUID, req ConfigureAPIKeyWebhooksRequest) (*APIKeyPublic, error) {
	key, err := s.repo.GetAPIKey(ctx, userID, keyID)
	if err != nil {
		return nil, err
	}
	for _, wh := range req.Webhooks {
		if strings.TrimSpace(wh.Event) == "" {
			return nil, fmt.Errorf("webhook event is required")
		}
		if err := v.ValidateOptionalURL(wh.TargetURL); err != nil {
			return nil, err
		}
	}
	before := key.Metadata
	if key.Metadata == nil {
		key.Metadata = datatypes.JSONMap{}
	}
	key.Metadata["webhooks"] = req.Webhooks
	if err := s.repo.SaveAPIKey(ctx, key); err != nil {
		return nil, err
	}
	s.audit("api_key.webhooks.update", userID, map[string]interface{}{"key_id": keyID, "before": before, "after": key.Metadata})
	pub := toAPIKeyPublic(*key)
	return &pub, nil
}

func (s *service) ValidateAPIKeySecret(ctx context.Context, req ValidateAPIKeyRequest) (*ValidateAPIKeyResponse, error) {
	secret := strings.TrimSpace(req.Secret)
	if secret == "" {
		return &ValidateAPIKeyResponse{Valid: false, Error: "secret is required"}, nil
	}
	keyPrefix := secret
	if len(keyPrefix) > 8 {
		keyPrefix = keyPrefix[:8]
	}
	candidates, err := s.repo.ListAPIKeysByPrefix(ctx, keyPrefix)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	for i := range candidates {
		key := candidates[i]
		if bcrypt.CompareHashAndPassword([]byte(key.KeyHash), []byte(secret)) != nil {
			continue
		}
		if !key.IsActive {
			return &ValidateAPIKeyResponse{Valid: false, Error: "api key revoked"}, nil
		}
		if key.ExpiresAt != nil && key.ExpiresAt.Before(now) {
			return &ValidateAPIKeyResponse{Valid: false, Error: "api key expired"}, nil
		}
		decision := s.usageTracker.Allow(now, key.ID, key.RateLimitPerMinute, key.RateLimitPerDay)
		if !decision.Allowed {
			if key.Metadata == nil {
				key.Metadata = datatypes.JSONMap{}
			}
			key.Metadata["last_rate_limit_exceeded_at"] = now.Format(time.RFC3339)
			_ = s.repo.SaveAPIKey(ctx, &key)
			s.audit("api_key.rate_limit_exceeded", key.UserID, map[string]interface{}{"key_id": key.ID})
			usage, _ := s.GetAPIKeyUsage(ctx, key.UserID, key.ID)
			return &ValidateAPIKeyResponse{
				Valid:         false,
				Key:           ptrAPIKeyPublic(toAPIKeyPublic(key)),
				Usage:         usage,
				Error:         "rate limit exceeded",
				RateLimited:   true,
				RetryAfterSec: decision.RetryAfterSec,
			}, nil
		}
		if key.Metadata == nil {
			key.Metadata = datatypes.JSONMap{}
		}
		s.bumpUsageMetadata(key.Metadata, now)
		key.LastUsedAt = &now
		if err := s.repo.SaveAPIKey(ctx, &key); err != nil {
			return nil, err
		}
		usage, _ := s.GetAPIKeyUsage(ctx, key.UserID, key.ID)
		pub := toAPIKeyPublic(key)
		return &ValidateAPIKeyResponse{Valid: true, Key: &pub, Usage: usage}, nil
	}
	return &ValidateAPIKeyResponse{Valid: false, Error: "invalid api key"}, nil
}

func (s *service) ListIntegrations(ctx context.Context, userID uuid.UUID) ([]IntegrationConfigurationPublic, error) {
	items, err := s.repo.ListIntegrations(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]IntegrationConfigurationPublic, 0, len(items))
	for _, item := range items {
		out = append(out, toIntegrationPublic(item))
	}
	return out, nil
}

func (s *service) ConfigureIntegration(ctx context.Context, userID uuid.UUID, req ConfigureIntegrationRequest) (*IntegrationConfigurationPublic, error) {
	if err := v.ValidateIntegrationType(req.IntegrationType); err != nil {
		return nil, err
	}
	if err := v.ValidateIntegrationName(req.IntegrationName); err != nil {
		return nil, err
	}
	if err := v.ValidateOptionalURL(req.WebhookURL); err != nil {
		return nil, err
	}
	configJSON, err := json.Marshal(req.Config)
	if err != nil {
		return nil, fmt.Errorf("invalid config payload")
	}
	encryptedConfig, err := settingsintegrations.EncryptConfig(s.vault, string(configJSON))
	if err != nil {
		return nil, err
	}
	h := sha256.Sum256(configJSON)
	encryptedSecret := ""
	if strings.TrimSpace(req.WebhookSecret) != "" {
		encryptedSecret, err = s.vault.EncryptString(req.WebhookSecret)
		if err != nil {
			return nil, err
		}
	}
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	item := &IntegrationConfiguration{
		ID:              uuid.New(),
		UserID:          userID,
		IntegrationType: req.IntegrationType,
		IntegrationName: req.IntegrationName,
		ConfigData:      encryptedConfig,
		ConfigHash:      hex.EncodeToString(h[:]),
		IsActive:        isActive,
		IsValid:         true,
		WebhookURL:      req.WebhookURL,
		WebhookSecret:   encryptedSecret,
		Metadata:        datatypes.JSONMap(req.Metadata),
	}
	if item.Metadata == nil {
		item.Metadata = datatypes.JSONMap{}
	}
	item.Metadata["templates"] = settingsintegrations.TemplateList()
	item.Metadata["oauth_start_url"] = settingsintegrations.BuildOAuthStartURL(req.IntegrationType)
	item.Metadata["health"] = settingsintegrations.ComputeHealth(item.IsActive, item.IsValid)
	item.Metadata["key_rotation_policy"] = map[string]interface{}{"enabled": true, "interval_days": 90}
	item.Metadata["last_rotated_at"] = time.Now().UTC().Format(time.RFC3339)
	if err := s.repo.UpsertIntegration(ctx, item); err != nil {
		return nil, err
	}
	s.audit("integration.configure", userID, map[string]interface{}{"after": item})
	public := toIntegrationPublic(*item)
	return &public, nil
}

func (s *service) BatchConfigureIntegrations(ctx context.Context, userID uuid.UUID, req BatchConfigureIntegrationsRequest) ([]IntegrationConfigurationPublic, error) {
	if len(req.Items) == 0 {
		return nil, fmt.Errorf("items are required")
	}
	out := make([]IntegrationConfigurationPublic, 0, len(req.Items))
	for _, item := range req.Items {
		pub, err := s.ConfigureIntegration(ctx, userID, item)
		if err != nil {
			return nil, err
		}
		out = append(out, *pub)
	}
	return out, nil
}

func (s *service) StartOAuthFlow(ctx context.Context, userID uuid.UUID, provider string) (*OAuthStartResponse, error) {
	if err := v.ValidateIntegrationType(provider); err != nil {
		return nil, err
	}
	stateSecret, _, _, err := settingsapi.GenerateSecret("oauth")
	if err != nil {
		return nil, err
	}
	expiresAt := time.Now().UTC().Add(10 * time.Minute)
	s.oauthMu.Lock()
	s.oauthStates[stateSecret] = oauthState{
		UserID:    userID,
		Provider:  provider,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now().UTC(),
	}
	s.oauthMu.Unlock()
	redirect := fmt.Sprintf("https://auth.%s.example.com/oauth/authorize?state=%s", provider, stateSecret)
	resp := &OAuthStartResponse{
		Provider:     provider,
		State:        stateSecret,
		RedirectURL:  redirect,
		ExpiresAt:    expiresAt,
		CallbackPath: fmt.Sprintf("/api/v1/settings/integrations/oauth/%s/callback", provider),
	}
	s.audit("integration.oauth.start", userID, map[string]interface{}{"provider": provider, "state_expires_at": expiresAt})
	_ = ctx
	return resp, nil
}

func (s *service) CompleteOAuthFlow(ctx context.Context, userID uuid.UUID, provider string, req OAuthCallbackRequest) (*OAuthCallbackResponse, error) {
	if strings.TrimSpace(req.State) == "" || strings.TrimSpace(req.Code) == "" {
		return nil, fmt.Errorf("state and code are required")
	}
	s.oauthMu.Lock()
	state, ok := s.oauthStates[req.State]
	if ok {
		delete(s.oauthStates, req.State)
	}
	s.oauthMu.Unlock()
	if !ok {
		return nil, fmt.Errorf("invalid oauth state")
	}
	if state.ExpiresAt.Before(time.Now().UTC()) {
		return nil, fmt.Errorf("oauth state expired")
	}
	if state.UserID != userID || state.Provider != provider {
		return nil, fmt.Errorf("oauth state mismatch")
	}

	name := strings.TrimSpace(req.IntegrationName)
	if name == "" {
		name = provider
	}
	integrationReq := ConfigureIntegrationRequest{
		IntegrationType: provider,
		IntegrationName: name,
		Config: map[string]interface{}{
			"oauth_access_token":       "stored_encrypted",
			"oauth_authorization_code": req.Code,
			"oauth_connected_at":       time.Now().UTC().Format(time.RFC3339),
		},
		Metadata: map[string]interface{}{
			"oauth_provider":       provider,
			"oauth_state_used":     true,
			"oauth_token_exchange": "placeholder",
		},
	}
	pub, err := s.ConfigureIntegration(ctx, userID, integrationReq)
	if err != nil {
		return nil, err
	}
	return &OAuthCallbackResponse{
		Provider:    provider,
		Connected:   true,
		Integration: pub,
		Message:     "oauth callback processed and integration configuration saved",
	}, nil
}

func (s *service) GetIntegrationHealth(ctx context.Context, userID, integrationID uuid.UUID) (*IntegrationHealthResponse, error) {
	item, err := s.repo.GetIntegration(ctx, userID, integrationID)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	health := settingsintegrations.ComputeHealth(item.IsActive, item.IsValid)
	item.Metadata = ensureJSONMap(item.Metadata)
	item.Metadata["health"] = health
	item.Metadata["health_checked_at"] = now.Format(time.RFC3339)
	rotationDue := false
	if rotatedAt, ok := parseMetadataTime(item.Metadata["last_rotated_at"]); ok {
		rm := encryption.NewRotationManager(encryption.RotationPolicy{Enabled: true, Interval: 90 * 24 * time.Hour})
		rotationDue = rm.ShouldRotate(rotatedAt, now)
		item.Metadata["credential_rotation_due"] = rotationDue
	}
	if item.IsActive && item.IsValid {
		item.LastSuccessfulConnection = &now
		item.ConnectionError = ""
	}
	if err := s.repo.UpsertIntegration(ctx, item); err != nil {
		return nil, err
	}
	return &IntegrationHealthResponse{
		IntegrationID:    item.ID,
		Health:           health,
		IsActive:         item.IsActive,
		IsValid:          item.IsValid,
		RotationDue:      rotationDue,
		LastCheckedAt:    now,
		LastSuccessfulAt: item.LastSuccessfulConnection,
		ConnectionError:  item.ConnectionError,
	}, nil
}

func (s *service) GetBilling(ctx context.Context, userID uuid.UUID) (*BillingSummary, error) {
	sub, err := s.repo.GetSubscription(ctx, userID)
	if err != nil {
		return nil, err
	}
	invoices, err := s.repo.ListInvoices(ctx, userID, 20)
	if err != nil {
		return nil, err
	}
	return &BillingSummary{Subscription: sub, Invoices: invoices}, nil
}

func (s *service) ListInvoices(ctx context.Context, userID uuid.UUID) ([]Invoice, error) {
	return s.repo.ListInvoices(ctx, userID, 100)
}

func (s *service) GetInvoicePDF(ctx context.Context, userID, invoiceID uuid.UUID) (*InvoicePDFResponse, error) {
	invoice, err := s.repo.GetInvoice(ctx, userID, invoiceID)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	if strings.TrimSpace(invoice.PDFURL) == "" {
		pdfURL, genErr := s.invoiceGenerator.GeneratePDF(invoice.InvoiceNumber)
		if genErr != nil {
			return nil, genErr
		}
		invoice.PDFURL = pdfURL
		invoice.PDFGeneratedAt = &now
		if err := s.repo.SaveInvoice(ctx, invoice); err != nil {
			return nil, err
		}
	}
	return &InvoicePDFResponse{
		InvoiceID:     invoice.ID,
		InvoiceNumber: invoice.InvoiceNumber,
		PDFURL:        invoice.PDFURL,
		GeneratedAt:   invoice.PDFGeneratedAt,
	}, nil
}

func (s *service) AddPaymentMethod(ctx context.Context, userID uuid.UUID, req AddPaymentMethodRequest) (*Subscription, error) {
	if strings.TrimSpace(req.PaymentMethodID) == "" {
		return nil, fmt.Errorf("payment_method_id is required")
	}
	if err := settingsbilling.ValidatePaymentMethodType(req.PaymentMethodType); err != nil {
		return nil, err
	}
	sub, err := s.repo.GetSubscription(ctx, userID)
	if err != nil {
		return nil, err
	}
	encryptedRef, err := s.vault.EncryptString(req.PaymentMethodID)
	if err != nil {
		return nil, err
	}
	sub.PaymentMethodID = encryptedRef
	sub.PaymentMethodType = req.PaymentMethodType
	if sub.UsageMetrics == nil {
		sub.UsageMetrics = datatypes.JSONMap(settingsbilling.DefaultUsageMetrics())
	}
	if err := s.repo.SaveSubscription(ctx, sub); err != nil {
		return nil, err
	}
	if strings.EqualFold(sub.Status, "past_due") || strings.EqualFold(sub.Status, "unpaid") {
		sub.Status = settingsbilling.NextDunningStatus(sub.Status, true)
		_ = s.repo.SaveSubscription(ctx, sub)
	}
	if pdfURL, genErr := s.invoiceGenerator.GeneratePDF(fmt.Sprintf("INV-%d-%s", time.Now().Year(), userID.String()[:8])); genErr == nil {
		log.Printf("settings.billing.invoice_generator placeholder: %s", pdfURL)
	}
	s.audit("billing.payment_method.add", userID, map[string]interface{}{"after": sub, "payment_method_type": req.PaymentMethodType})
	return sub, nil
}

func (s *service) audit(event string, userID uuid.UUID, details map[string]interface{}) {
	if details == nil {
		details = map[string]interface{}{}
	}
	log.Printf("settings_audit event=%s user_id=%s details=%v", event, userID, details)
}

func toAPIKeyPublic(k APIKey) APIKeyPublic {
	return APIKeyPublic{
		ID:                 k.ID,
		Name:               k.Name,
		KeyPrefix:          k.KeyPrefix,
		KeyLastFour:        k.KeyLastFour,
		Scopes:             []string(k.Scopes),
		RateLimitPerMinute: k.RateLimitPerMinute,
		RateLimitPerDay:    k.RateLimitPerDay,
		ExpiresAt:          k.ExpiresAt,
		IsActive:           k.IsActive,
		LastUsedAt:         k.LastUsedAt,
		Metadata:           k.Metadata,
		CreatedAt:          k.CreatedAt,
	}
}

func toIntegrationPublic(i IntegrationConfiguration) IntegrationConfigurationPublic {
	return IntegrationConfigurationPublic{
		ID:                       i.ID,
		IntegrationType:          i.IntegrationType,
		IntegrationName:          i.IntegrationName,
		ConfigHash:               i.ConfigHash,
		IsActive:                 i.IsActive,
		IsValid:                  i.IsValid,
		LastSuccessfulConnection: i.LastSuccessfulConnection,
		ConnectionError:          i.ConnectionError,
		WebhookURL:               i.WebhookURL,
		WebhookLastDelivered:     i.WebhookLastDelivered,
		Metadata:                 i.Metadata,
		CreatedAt:                i.CreatedAt,
		UpdatedAt:                i.UpdatedAt,
	}
}

func (s *service) bumpUsageMetadata(metadata datatypes.JSONMap, now time.Time) {
	day := now.UTC().Format("2006-01-02")
	lastDay := stringValue(metadata["usage_day"])
	if lastDay != day {
		metadata["usage_day"] = day
		metadata["usage_today"] = 0
	}
	metadata["usage_total"] = jsonNumberToInt(metadata["usage_total"]) + 1
	metadata["usage_today"] = jsonNumberToInt(metadata["usage_today"]) + 1
}

func ensureJSONMap(m datatypes.JSONMap) datatypes.JSONMap {
	if m == nil {
		return datatypes.JSONMap{}
	}
	return m
}

func ptrAPIKeyPublic(v APIKeyPublic) *APIKeyPublic {
	return &v
}

func stringValue(v interface{}) string {
	switch x := v.(type) {
	case string:
		return x
	default:
		return ""
	}
}

func parseMetadataTime(v interface{}) (time.Time, bool) {
	s := stringValue(v)
	if s == "" {
		return time.Time{}, false
	}
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return time.Time{}, false
	}
	return t, true
}

func jsonNumberToInt(v interface{}) int {
	switch n := v.(type) {
	case int:
		return n
	case int32:
		return int(n)
	case int64:
		return int(n)
	case float64:
		return int(n)
	case json.Number:
		i, err := n.Int64()
		if err == nil {
			return int(i)
		}
		f, ferr := n.Float64()
		if ferr == nil {
			return int(f)
		}
	}
	return 0
}
