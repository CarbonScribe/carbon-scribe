package integration

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// oauthMockRepository implements Repository purely in memory, covering the
// subset of methods exercised by the OAuth2 authorize/callback flow.
type oauthMockRepository struct {
	Repository

	connectionsByID       map[string]*IntegrationConnection
	connectionsByProvider map[string]*IntegrationConnection
	states                map[string]*OAuthState
	tokens                map[string]*OAuthToken
}

func newOAuthMockRepository() *oauthMockRepository {
	return &oauthMockRepository{
		connectionsByID:       map[string]*IntegrationConnection{},
		connectionsByProvider: map[string]*IntegrationConnection{},
		states:                map[string]*OAuthState{},
		tokens:                map[string]*OAuthToken{},
	}
}

func (m *oauthMockRepository) addConnection(conn *IntegrationConnection) {
	m.connectionsByID[conn.ID] = conn
	m.connectionsByProvider[conn.Provider] = conn
}

func (m *oauthMockRepository) GetConnection(ctx context.Context, id string) (*IntegrationConnection, error) {
	conn, ok := m.connectionsByID[id]
	if !ok {
		return nil, errors.New("connection not found")
	}
	return conn, nil
}

func (m *oauthMockRepository) GetConnectionByProvider(ctx context.Context, provider string) (*IntegrationConnection, error) {
	conn, ok := m.connectionsByProvider[provider]
	if !ok {
		return nil, errors.New("connection not found")
	}
	return conn, nil
}

func (m *oauthMockRepository) CreateOAuthState(ctx context.Context, state *OAuthState) error {
	cp := *state
	m.states[state.State] = &cp
	return nil
}

func (m *oauthMockRepository) GetOAuthStateByState(ctx context.Context, state string) (*OAuthState, error) {
	s, ok := m.states[state]
	if !ok {
		return nil, errors.New("state not found")
	}
	cp := *s
	return &cp, nil
}

func (m *oauthMockRepository) MarkOAuthStateConsumed(ctx context.Context, state string) error {
	s, ok := m.states[state]
	if !ok {
		return errors.New("state not found")
	}
	s.Consumed = true
	return nil
}

func (m *oauthMockRepository) DeleteExpiredOAuthStates(ctx context.Context, before time.Time) error {
	for k, s := range m.states {
		if s.ExpiresAt.Before(before) {
			delete(m.states, k)
		}
	}
	return nil
}

func (m *oauthMockRepository) SaveOAuthToken(ctx context.Context, token *OAuthToken) error {
	cp := *token
	m.tokens[token.ConnectionID] = &cp
	return nil
}

func (m *oauthMockRepository) GetOAuthToken(ctx context.Context, connectionID string) (*OAuthToken, error) {
	t, ok := m.tokens[connectionID]
	if !ok {
		return nil, errors.New("token not found")
	}
	return t, nil
}

func newTestConnection() *IntegrationConnection {
	return &IntegrationConnection{
		ID:       "conn-1",
		Provider: "stripe",
		Config: map[string]any{
			"client_id":     "client-abc",
			"client_secret": "secret-xyz",
			"auth_url":      "https://stripe.com/oauth/authorize",
			"redirect_uri":  "https://app.example.com/callback",
			"scope":         "read write",
		},
	}
}

// ============================================================================
// InitiateOAuth2
// ============================================================================

func TestInitiateOAuth2GeneratesStateAndPKCEChallenge(t *testing.T) {
	repo := newOAuthMockRepository()
	conn := newTestConnection()
	repo.addConnection(conn)
	svc := NewService(repo)

	authURL, err := svc.InitiateOAuth2(context.Background(), "stripe", "")
	require.NoError(t, err)

	parsed, err := url.Parse(authURL)
	require.NoError(t, err)
	q := parsed.Query()

	state := q.Get("state")
	assert.NotEmpty(t, state)
	assert.Equal(t, "S256", q.Get("code_challenge_method"))
	assert.NotEmpty(t, q.Get("code_challenge"))
	assert.Equal(t, "client-abc", q.Get("client_id"))
	assert.Equal(t, "https://app.example.com/callback", q.Get("redirect_uri"))

	stored, ok := repo.states[state]
	require.True(t, ok, "state must be persisted")
	assert.False(t, stored.Consumed)
	assert.WithinDuration(t, time.Now().Add(oauthStateTTL), stored.ExpiresAt, 5*time.Second)

	// code_challenge must be the S256 transform of the persisted code_verifier.
	expectedChallenge := pkceChallengeS256(stored.CodeVerifier)
	assert.Equal(t, expectedChallenge, q.Get("code_challenge"))
}

func TestInitiateOAuth2RejectsMismatchedRedirectURI(t *testing.T) {
	repo := newOAuthMockRepository()
	repo.addConnection(newTestConnection())
	svc := NewService(repo)

	_, err := svc.InitiateOAuth2(context.Background(), "stripe", "https://evil.example.com/callback")
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrRedirectURIMismatch)
}

func TestInitiateOAuth2UnknownProvider(t *testing.T) {
	repo := newOAuthMockRepository()
	svc := NewService(repo)

	_, err := svc.InitiateOAuth2(context.Background(), "unknown", "")
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrNoConnectionForProvider)
}

// ============================================================================
// HandleOAuth2Callback
// ============================================================================

func setupCallbackTest(t *testing.T, tokenServerURL string) (*Service, *oauthMockRepository, *OAuthState) {
	t.Helper()
	repo := newOAuthMockRepository()
	conn := newTestConnection()
	if tokenServerURL != "" {
		conn.Config["token_url"] = tokenServerURL
	}
	repo.addConnection(conn)
	svc := NewService(repo)

	authURL, err := svc.InitiateOAuth2(context.Background(), "stripe", "")
	require.NoError(t, err)
	parsed, err := url.Parse(authURL)
	require.NoError(t, err)
	state := parsed.Query().Get("state")

	stored := repo.states[state]
	return svc, repo, stored
}

func TestHandleOAuth2CallbackValidStateExchangesAndPersistsToken(t *testing.T) {
	var receivedVerifier string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseForm())
		receivedVerifier = r.Form.Get("code_verifier")
		assert.Equal(t, "authorization_code", r.Form.Get("grant_type"))
		assert.Equal(t, "auth-code-123", r.Form.Get("code"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"at-1","refresh_token":"rt-1","token_type":"bearer","expires_in":3600,"scope":"read write"}`))
	}))
	defer server.Close()

	svc, repo, stored := setupCallbackTest(t, server.URL)

	err := svc.HandleOAuth2Callback(context.Background(), "stripe", "auth-code-123", stored.State)
	require.NoError(t, err)

	assert.Equal(t, stored.CodeVerifier, receivedVerifier)

	token, ok := repo.tokens["conn-1"]
	require.True(t, ok, "token must be persisted")
	assert.Equal(t, "at-1", token.AccessToken)
	assert.Equal(t, "rt-1", token.RefreshToken)

	consumedState := repo.states[stored.State]
	assert.True(t, consumedState.Consumed)
}

func TestHandleOAuth2CallbackMissingState(t *testing.T) {
	svc, _, _ := setupCallbackTest(t, "")

	err := svc.HandleOAuth2Callback(context.Background(), "stripe", "auth-code-123", "")
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrInvalidState)
}

func TestHandleOAuth2CallbackUnknownState(t *testing.T) {
	svc, _, _ := setupCallbackTest(t, "")

	err := svc.HandleOAuth2Callback(context.Background(), "stripe", "auth-code-123", "never-issued-state")
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrInvalidState)
}

func TestHandleOAuth2CallbackExpiredState(t *testing.T) {
	svc, repo, stored := setupCallbackTest(t, "")
	repo.states[stored.State].ExpiresAt = time.Now().Add(-1 * time.Minute)

	err := svc.HandleOAuth2Callback(context.Background(), "stripe", "auth-code-123", stored.State)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrExpiredState)
}

func TestHandleOAuth2CallbackReplayedStateIsRejected(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"at-1","token_type":"bearer","expires_in":3600}`))
	}))
	defer server.Close()

	svc, _, stored := setupCallbackTest(t, server.URL)

	err := svc.HandleOAuth2Callback(context.Background(), "stripe", "auth-code-123", stored.State)
	require.NoError(t, err)

	// Replaying the same state a second time must fail even though the
	// first exchange succeeded.
	err = svc.HandleOAuth2Callback(context.Background(), "stripe", "auth-code-123", stored.State)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrStateAlreadyUsed)
}

func TestHandleOAuth2CallbackTokenExchangeFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"invalid_grant"}`))
	}))
	defer server.Close()

	svc, repo, stored := setupCallbackTest(t, server.URL)

	err := svc.HandleOAuth2Callback(context.Background(), "stripe", "auth-code-123", stored.State)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrTokenExchangeFailed)

	// The state must still be consumed (single-use) even though the
	// exchange failed, so the same code/state pair cannot be retried.
	assert.True(t, repo.states[stored.State].Consumed)
}

// ============================================================================
// Incoming webhook signature verification
// ============================================================================

func TestVerifyIncomingWebhookSignatureValid(t *testing.T) {
	repo := newOAuthMockRepository()
	conn := &IntegrationConnection{
		ID:          "conn-2",
		Provider:    "sentinel",
		Credentials: map[string]any{"webhook_secret": "shh"},
	}
	repo.addConnection(conn)
	svc := NewService(repo)

	payload := []byte(`{"event":"ping"}`)
	mac := hmac.New(sha256.New, []byte("shh"))
	mac.Write(payload)
	sig := hex.EncodeToString(mac.Sum(nil))

	err := svc.VerifyIncomingWebhookSignature(context.Background(), "conn-2", payload, sig)
	assert.NoError(t, err)
}

func TestVerifyIncomingWebhookSignatureInvalid(t *testing.T) {
	repo := newOAuthMockRepository()
	conn := &IntegrationConnection{
		ID:          "conn-2",
		Provider:    "sentinel",
		Credentials: map[string]any{"webhook_secret": "shh"},
	}
	repo.addConnection(conn)
	svc := NewService(repo)

	err := svc.VerifyIncomingWebhookSignature(context.Background(), "conn-2", []byte(`{"event":"ping"}`), "deadbeef")
	assert.Error(t, err)
}

func TestVerifyIncomingWebhookSignatureMissing(t *testing.T) {
	repo := newOAuthMockRepository()
	svc := NewService(repo)

	err := svc.VerifyIncomingWebhookSignature(context.Background(), "conn-2", []byte(`{}`), "")
	assert.Error(t, err)
}
