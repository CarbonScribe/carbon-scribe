package integration

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	rpcclient "github.com/stellar/go/clients/rpcclient"
)

// ProbeStatus is the outcome of a single connectivity probe (#796).
type ProbeStatus string

const (
	ProbeHealthy   ProbeStatus = "healthy"
	ProbeDegraded  ProbeStatus = "degraded"
	ProbeUnhealthy ProbeStatus = "unhealthy"
)

// DegradedLatencyThresholdMs is the measured latency above which an
// otherwise-successful probe is downgraded from healthy to degraded.
const DegradedLatencyThresholdMs = 500

// ProbeResult is what a ConnectivityProber reports back for one probe.
type ProbeResult struct {
	Status    ProbeStatus
	LatencyMs int
	Message   string
}

// ConnectivityProber performs a real outbound request against a specific
// integration provider (#796), replacing the previous placeholder that
// always recorded "healthy" without contacting anything.
type ConnectivityProber interface {
	Probe(ctx context.Context, client *http.Client, conn *IntegrationConnection) ProbeResult
}

// proberForProvider returns the ConnectivityProber for conn.Provider, or an
// error for any provider without one — TestConnection surfaces this as a
// clear "unsupported provider" failure rather than silently reporting
// healthy for a connection it never actually checked.
func proberForProvider(provider string) (ConnectivityProber, error) {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "stripe":
		return stripeProber{}, nil
	case "stellar":
		return stellarProber{}, nil
	case "sentinel":
		return sentinelProber{}, nil
	default:
		return nil, fmt.Errorf("unsupported provider %q: no connectivity probe is defined for it", provider)
	}
}

// stringConfig reads a string value out of an IntegrationConnection's
// Config/Credentials map, falling back to fallback when the key is absent,
// empty, or not a string. It's used both for the per-connection base URL
// override (which lets tests point a prober at an httptest.Server) and for
// provider credentials.
func stringConfig(m map[string]any, key, fallback string) string {
	if v, ok := m[key].(string); ok && strings.TrimSpace(v) != "" {
		return v
	}
	return fallback
}

// doProbe performs req, times it, and classifies the result. Shared by every
// plain-HTTP prober (Stripe, Sentinel); the Stellar prober times its own SDK
// call instead since it doesn't build an *http.Request directly.
func doProbe(client *http.Client, req *http.Request) ProbeResult {
	start := time.Now()
	resp, err := client.Do(req)
	latencyMs := int(time.Since(start).Milliseconds())
	if err != nil {
		return ProbeResult{Status: ProbeUnhealthy, LatencyMs: latencyMs, Message: err.Error()}
	}
	defer resp.Body.Close()

	status, message := classifyStatusCode(resp.StatusCode)
	if status == ProbeHealthy && latencyMs > DegradedLatencyThresholdMs {
		return ProbeResult{Status: ProbeDegraded, LatencyMs: latencyMs, Message: fmt.Sprintf("response was slow (%dms)", latencyMs)}
	}
	return ProbeResult{Status: status, LatencyMs: latencyMs, Message: message}
}

// classifyStatusCode maps an HTTP response status to a ProbeStatus: 2xx is
// healthy; 401/403 is an unhealthy auth failure; 429/5xx is a degraded,
// retryable condition; anything else is an unhealthy, unexpected response.
func classifyStatusCode(code int) (ProbeStatus, string) {
	switch {
	case code >= 200 && code < 300:
		return ProbeHealthy, "connection successful"
	case code == http.StatusUnauthorized || code == http.StatusForbidden:
		return ProbeUnhealthy, fmt.Sprintf("authentication failed (status %d)", code)
	case code == http.StatusTooManyRequests || code >= 500:
		return ProbeDegraded, fmt.Sprintf("provider returned a retryable status %d", code)
	default:
		return ProbeUnhealthy, fmt.Sprintf("unexpected status %d", code)
	}
}

// stripeProber checks connectivity via an authenticated GET /v1/balance,
// which requires a valid secret key and nothing else.
type stripeProber struct{}

func (stripeProber) Probe(ctx context.Context, client *http.Client, conn *IntegrationConnection) ProbeResult {
	apiKey := stringConfig(conn.Credentials, "api_key", "")
	if apiKey == "" {
		return ProbeResult{Status: ProbeUnhealthy, Message: "missing api_key credential"}
	}

	baseURL := stringConfig(conn.Config, "base_url", "https://api.stripe.com")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/v1/balance", nil)
	if err != nil {
		return ProbeResult{Status: ProbeUnhealthy, Message: err.Error()}
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)

	return doProbe(client, req)
}

// sentinelProber checks connectivity against Sentinel Hub's OAuth2 token
// endpoint using the client-credentials grant — a working client_id/secret
// pair is the minimum needed to use the API at all.
type sentinelProber struct{}

func (sentinelProber) Probe(ctx context.Context, client *http.Client, conn *IntegrationConnection) ProbeResult {
	clientID := stringConfig(conn.Credentials, "client_id", "")
	clientSecret := stringConfig(conn.Credentials, "client_secret", "")
	if clientID == "" || clientSecret == "" {
		return ProbeResult{Status: ProbeUnhealthy, Message: "missing client_id/client_secret credentials"}
	}

	baseURL := stringConfig(conn.Config, "base_url", "https://services.sentinel-hub.com")
	form := url.Values{
		"grant_type":    {"client_credentials"},
		"client_id":     {clientID},
		"client_secret": {clientSecret},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/oauth/token", strings.NewReader(form.Encode()))
	if err != nil {
		return ProbeResult{Status: ProbeUnhealthy, Message: err.Error()}
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	return doProbe(client, req)
}

// stellarProber checks connectivity via the Soroban RPC getHealth method,
// against the RPC URL the connection was configured with — not the
// platform's own minting RPC endpoint (internal/config.SorobanConfig),
// since this probes a user-registered external connection.
type stellarProber struct{}

func (stellarProber) Probe(ctx context.Context, client *http.Client, conn *IntegrationConnection) ProbeResult {
	rpcURL := stringConfig(conn.Config, "rpc_url", stringConfig(conn.Config, "base_url", ""))
	if rpcURL == "" {
		return ProbeResult{Status: ProbeUnhealthy, Message: "missing rpc_url (or base_url) config"}
	}

	rpc := rpcclient.NewClient(rpcURL, client)
	defer rpc.Close()

	start := time.Now()
	health, err := rpc.GetHealth(ctx)
	latencyMs := int(time.Since(start).Milliseconds())
	if err != nil {
		return ProbeResult{Status: ProbeUnhealthy, LatencyMs: latencyMs, Message: err.Error()}
	}

	if !strings.EqualFold(health.Status, "healthy") {
		return ProbeResult{Status: ProbeDegraded, LatencyMs: latencyMs, Message: fmt.Sprintf("RPC reported status %q", health.Status)}
	}
	if latencyMs > DegradedLatencyThresholdMs {
		return ProbeResult{Status: ProbeDegraded, LatencyMs: latencyMs, Message: fmt.Sprintf("response was slow (%dms)", latencyMs)}
	}
	return ProbeResult{Status: ProbeHealthy, LatencyMs: latencyMs, Message: fmt.Sprintf("latest ledger %d", health.LatestLedger)}
}
