package integration

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/google/uuid"
)

const (
	// PlaceholderHealthCheckLatencyMs is a temporary placeholder latency value
	// pending real latency measurement in TestConnection.
	PlaceholderHealthCheckLatencyMs = 45
)

type Service struct {
	repo Repository

	// HTTPClient is used for the OAuth2 token exchange call. Defaults to
	// http.DefaultClient when nil; overridable in tests to point at an
	// httptest.Server.
	HTTPClient *http.Client
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// RegisterConnection creates a new integration connection
func (s *Service) RegisterConnection(ctx context.Context, conn *IntegrationConnection) error {
	conn.CreatedAt = time.Now()
	conn.UpdatedAt = time.Now()
	// In a real implementation, we would encrypt Credentials here before saving
	return s.repo.CreateConnection(ctx, conn)
}

// TestConnection verifies connectivity (placeholder)
func (s *Service) TestConnection(ctx context.Context, id string) error {
	conn, err := s.repo.GetConnection(ctx, id)
	if err != nil {
		return err
	}

	// Simulate connection test based on Provider
	// e.g., if conn.Provider == "stripe" { ... }

	// Update LastTested
	now := time.Now()
	conn.LastTested = &now
	_ = s.repo.UpdateConnection(ctx, conn)

	// Record Health
	_ = s.repo.RecordHealth(ctx, &IntegrationHealth{
		ConnectionID: conn.ID,
		Status:       "healthy",
		LatencyMs:    PlaceholderHealthCheckLatencyMs,
		CheckedAt:    time.Now(),
		Message:      "Connection successful",
	})

	return nil
}

// ConfigureWebhook creates a new outgoing webhook configuration
func (s *Service) ConfigureWebhook(ctx context.Context, webhook *WebhookConfig) error {
	if webhook.Secret == "" {
		webhook.Secret = uuid.New().String() // Generate secret if not provided
	}
	webhook.CreatedAt = time.Now()
	webhook.UpdatedAt = time.Now()
	return s.repo.CreateWebhookConfig(ctx, webhook)
}

// SubscribeToEvent subscribes an external service to an internal event
func (s *Service) SubscribeToEvent(ctx context.Context, sub *EventSubscription) error {
	sub.CreatedAt = time.Now()
	sub.UpdatedAt = time.Now()
	return s.repo.CreateSubscription(ctx, sub)
}

// GetIntegrationHealth returns the latest health status
func (s *Service) GetIntegrationHealth(ctx context.Context, connectionID string) (*IntegrationHealth, error) {
	return s.repo.GetLatestHealth(ctx, connectionID)
}

// TriggerWebhook (Placeholder for event processing logic)
func (s *Service) TriggerWebhook(ctx context.Context, eventType string, payload map[string]any) error {
	// 1. Find subscriptions
	subs, err := s.repo.ListSubscriptions(ctx, eventType)
	if err != nil {
		return err
	}

	// 2. In a real system, we would enqueue these for async delivery
	for _, sub := range subs {
		// Simulate delivery
		delivery := &WebhookDelivery{
			WebhookID: sub.ID, // Using Sub ID as placeholder
			EventID:   uuid.New().String(),
			EventType: eventType,
			Payload:   payload,
			Status:    "pending",
			CreatedAt: time.Now(),
		}
		_ = s.repo.CreateWebhookDelivery(ctx, delivery)
	}

	return nil
}

// OAuth2 Flow

// InitiateOAuth2 generates and persists a unique state value and PKCE
// code_verifier/code_challenge pair for the connection registered against
// provider, then returns the authorization URL to redirect the user to.
//
// redirectURI is optional; when supplied it must match the redirect_uri
// registered for the connection (its Config["redirect_uri"]), otherwise the
// request is rejected to prevent redirect_uri substitution. When omitted,
// the registered redirect_uri is used.
func (s *Service) InitiateOAuth2(ctx context.Context, provider, redirectURI string) (string, error) {
	conn, err := s.repo.GetConnectionByProvider(ctx, provider)
	if err != nil {
		return "", fmt.Errorf("%w: %s", ErrNoConnectionForProvider, provider)
	}

	registeredRedirect, _ := conn.Config["redirect_uri"].(string)
	if redirectURI == "" {
		redirectURI = registeredRedirect
	} else if registeredRedirect != "" && redirectURI != registeredRedirect {
		return "", ErrRedirectURIMismatch
	}

	authURL, _ := conn.Config["auth_url"].(string)
	if authURL == "" {
		authURL = "https://" + provider + ".com/oauth/authorize"
	}
	clientID, _ := conn.Config["client_id"].(string)
	scope, _ := conn.Config["scope"].(string)

	state, err := generateRandomURLSafeString(oauthRandomBytes)
	if err != nil {
		return "", err
	}
	codeVerifier, err := generateRandomURLSafeString(oauthRandomBytes)
	if err != nil {
		return "", err
	}
	codeChallenge := pkceChallengeS256(codeVerifier)

	oauthState := &OAuthState{
		State:        state,
		Provider:     provider,
		ConnectionID: conn.ID,
		CodeVerifier: codeVerifier,
		RedirectURI:  redirectURI,
		ExpiresAt:    time.Now().Add(oauthStateTTL),
	}
	if err := s.repo.CreateOAuthState(ctx, oauthState); err != nil {
		return "", err
	}

	// Opportunistic cleanup of stale entries; failure here is not fatal to
	// issuing the new authorization request.
	_ = s.repo.DeleteExpiredOAuthStates(ctx, time.Now())

	params := url.Values{}
	params.Set("response_type", "code")
	params.Set("state", state)
	params.Set("code_challenge", codeChallenge)
	params.Set("code_challenge_method", "S256")
	if clientID != "" {
		params.Set("client_id", clientID)
	}
	if redirectURI != "" {
		params.Set("redirect_uri", redirectURI)
	}
	if scope != "" {
		params.Set("scope", scope)
	}

	return authURL + "?" + params.Encode(), nil
}

// HandleOAuth2Callback validates the state/code returned by the provider,
// exchanges the authorization code for a token (including the PKCE
// code_verifier), and persists the resulting token.
//
// The state is marked consumed before the token exchange is attempted so a
// replayed callback (e.g. duplicate provider retry, or an attacker re-using
// an intercepted URL) can never succeed twice, even if the exchange itself
// later fails.
func (s *Service) HandleOAuth2Callback(ctx context.Context, provider, code, state string) error {
	if code == "" {
		return errors.New("invalid code")
	}
	if state == "" {
		return ErrInvalidState
	}

	oauthState, err := s.repo.GetOAuthStateByState(ctx, state)
	if err != nil {
		return ErrInvalidState
	}
	if oauthState.Provider != provider {
		return ErrInvalidState
	}
	if oauthState.Consumed {
		return ErrStateAlreadyUsed
	}
	if time.Now().After(oauthState.ExpiresAt) {
		return ErrExpiredState
	}

	if err := s.repo.MarkOAuthStateConsumed(ctx, state); err != nil {
		return err
	}

	conn, err := s.repo.GetConnection(ctx, oauthState.ConnectionID)
	if err != nil {
		return fmt.Errorf("connection not found: %w", err)
	}

	tokenURL, _ := conn.Config["token_url"].(string)
	if tokenURL == "" {
		tokenURL = "https://" + provider + ".com/oauth/token"
	}
	clientID, _ := conn.Config["client_id"].(string)
	clientSecret, _ := conn.Config["client_secret"].(string)

	token, err := s.exchangeCodeForToken(ctx, tokenURL, code, oauthState.CodeVerifier, oauthState.RedirectURI, clientID, clientSecret)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrTokenExchangeFailed, err)
	}

	now := time.Now()
	oauthToken := &OAuthToken{
		ConnectionID: conn.ID,
		Provider:     provider,
		AccessToken:  token.AccessToken,
		RefreshToken: token.RefreshToken,
		TokenType:    token.TokenType,
		ExpiresAt:    now.Add(time.Duration(token.ExpiresIn) * time.Second),
		Scope:        token.Scope,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	return s.repo.SaveOAuthToken(ctx, oauthToken)
}
