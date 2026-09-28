package integration

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	// oauthStateTTL is how long an issued state/code_verifier pair remains
	// valid before it must be rejected as expired.
	oauthStateTTL = 10 * time.Minute

	// oauthRandomBytes is the number of random bytes used for both the state
	// value and the PKCE code_verifier (32 bytes -> 43 base64url chars,
	// within the 43-128 char range required by RFC 7636).
	oauthRandomBytes = 32
)

// Errors returned by the OAuth2 authorize/callback flow. Handlers use
// errors.Is against these to return distinct, structured responses instead
// of collapsing every failure into a generic 400.
var (
	ErrInvalidState            = errors.New("invalid state")
	ErrExpiredState            = errors.New("expired state")
	ErrStateAlreadyUsed        = errors.New("state already used")
	ErrRedirectURIMismatch     = errors.New("redirect_uri mismatch")
	ErrTokenExchangeFailed     = errors.New("token exchange failed")
	ErrNoConnectionForProvider = errors.New("no connection registered for provider")
)

type tokenExchangeResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
}

func generateRandomURLSafeString(nBytes int) (string, error) {
	b := make([]byte, nBytes)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate random value: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// pkceChallengeS256 derives the PKCE code_challenge from a code_verifier
// using the S256 transform required by RFC 7636.
func pkceChallengeS256(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

// exchangeCodeForToken performs the actual authorization_code -> token HTTP
// exchange with the provider's token endpoint, including the PKCE
// code_verifier per RFC 7636.
func (s *Service) exchangeCodeForToken(ctx context.Context, tokenURL, code, codeVerifier, redirectURI, clientID, clientSecret string) (*tokenExchangeResponse, error) {
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("code_verifier", codeVerifier)
	if clientID != "" {
		form.Set("client_id", clientID)
	}
	if clientSecret != "" {
		form.Set("client_secret", clientSecret)
	}
	if redirectURI != "" {
		form.Set("redirect_uri", redirectURI)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to build token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	client := s.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("token request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("failed to read token response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("token endpoint returned status %d: %s", resp.StatusCode, string(body))
	}

	var tokenResp tokenExchangeResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}
	if tokenResp.AccessToken == "" {
		return nil, errors.New("token response missing access_token")
	}

	return &tokenResp, nil
}

// VerifyIncomingWebhookSignature validates an inbound webhook payload against
// the HMAC-SHA256 signature computed from the secret registered for the
// given connection, using a constant-time comparison.
func (s *Service) VerifyIncomingWebhookSignature(ctx context.Context, connectionID string, payload []byte, signature string) error {
	if signature == "" {
		return errors.New("missing signature")
	}

	conn, err := s.repo.GetConnection(ctx, connectionID)
	if err != nil {
		return fmt.Errorf("connection not found: %w", err)
	}

	secret, _ := conn.Credentials["webhook_secret"].(string)
	if secret == "" {
		return errors.New("no webhook secret configured for connection")
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expected := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(expected), []byte(signature)) {
		return errors.New("signature mismatch")
	}
	return nil
}
