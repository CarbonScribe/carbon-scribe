package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"
)

func TestProberForProvider_UnsupportedProviderFails(t *testing.T) {
	_, err := proberForProvider("unknown-provider")
	if err == nil {
		t.Fatal("expected an error for an unsupported provider")
	}
}

func TestProberForProvider_KnownProvidersResolve(t *testing.T) {
	for _, provider := range []string{"stripe", "stellar", "sentinel", "STRIPE"} {
		if _, err := proberForProvider(provider); err != nil {
			t.Errorf("provider %q: unexpected error: %v", provider, err)
		}
	}
}

func TestStripeProber_HealthyRespondsOK(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer sk_test_123" {
			t.Errorf("unexpected Authorization header: %q", got)
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"object":"balance"}`))
	}))
	defer server.Close()

	conn := &IntegrationConnection{
		Provider:    "stripe",
		Credentials: map[string]any{"api_key": "sk_test_123"},
		Config:      map[string]any{"base_url": server.URL},
	}

	result := stripeProber{}.Probe(context.Background(), server.Client(), conn)
	if result.Status != ProbeHealthy {
		t.Fatalf("expected healthy, got %q (%s)", result.Status, result.Message)
	}
}

func TestStripeProber_UnauthorizedIsUnhealthy(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	conn := &IntegrationConnection{
		Provider:    "stripe",
		Credentials: map[string]any{"api_key": "sk_invalid"},
		Config:      map[string]any{"base_url": server.URL},
	}

	result := stripeProber{}.Probe(context.Background(), server.Client(), conn)
	if result.Status != ProbeUnhealthy {
		t.Fatalf("expected unhealthy, got %q", result.Status)
	}
}

func TestStripeProber_SlowResponseIsDegraded(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep((DegradedLatencyThresholdMs + 200) * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	conn := &IntegrationConnection{
		Provider:    "stripe",
		Credentials: map[string]any{"api_key": "sk_test_123"},
		Config:      map[string]any{"base_url": server.URL},
	}

	result := stripeProber{}.Probe(context.Background(), server.Client(), conn)
	if result.Status != ProbeDegraded {
		t.Fatalf("expected degraded, got %q", result.Status)
	}
}

func TestStripeProber_UnreachableIsUnhealthy(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	unreachableURL := server.URL
	server.Close() // nothing is listening on this address anymore

	conn := &IntegrationConnection{
		Provider:    "stripe",
		Credentials: map[string]any{"api_key": "sk_test_123"},
		Config:      map[string]any{"base_url": unreachableURL},
	}

	result := stripeProber{}.Probe(context.Background(), http.DefaultClient, conn)
	if result.Status != ProbeUnhealthy {
		t.Fatalf("expected unhealthy, got %q", result.Status)
	}
}

func TestStripeProber_MissingCredentialIsUnhealthy(t *testing.T) {
	conn := &IntegrationConnection{Provider: "stripe"}
	result := stripeProber{}.Probe(context.Background(), http.DefaultClient, conn)
	if result.Status != ProbeUnhealthy {
		t.Fatalf("expected unhealthy, got %q", result.Status)
	}
}

func TestSentinelProber_HealthyRespondsOK(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.FormValue("client_id"); got != "client-123" {
			t.Errorf("unexpected client_id: %q", got)
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"access_token":"tok","expires_in":3600}`))
	}))
	defer server.Close()

	conn := &IntegrationConnection{
		Provider:    "sentinel",
		Credentials: map[string]any{"client_id": "client-123", "client_secret": "secret"},
		Config:      map[string]any{"base_url": server.URL},
	}

	result := sentinelProber{}.Probe(context.Background(), server.Client(), conn)
	if result.Status != ProbeHealthy {
		t.Fatalf("expected healthy, got %q (%s)", result.Status, result.Message)
	}
}

func TestSentinelProber_UnauthorizedIsUnhealthy(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	conn := &IntegrationConnection{
		Provider:    "sentinel",
		Credentials: map[string]any{"client_id": "client-123", "client_secret": "wrong"},
		Config:      map[string]any{"base_url": server.URL},
	}

	result := sentinelProber{}.Probe(context.Background(), server.Client(), conn)
	if result.Status != ProbeUnhealthy {
		t.Fatalf("expected unhealthy, got %q", result.Status)
	}
}

// fakeSorobanHealthServer echoes a getHealth JSON-RPC response, matching the
// request's id the way a real Soroban RPC server would.
func fakeSorobanHealthServer(t *testing.T, status string, latestLedger int) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			ID     json.RawMessage `json:"id"`
			Method string          `json:"method"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode JSON-RPC request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"jsonrpc":"2.0","id":` + string(req.ID) + `,"result":{"status":"` + status + `","latestLedger":` + strconv.Itoa(latestLedger) + `}}`))
	}))
}

func TestStellarProber_HealthyRespondsOK(t *testing.T) {
	server := fakeSorobanHealthServer(t, "healthy", 1000)
	defer server.Close()

	conn := &IntegrationConnection{
		Provider: "stellar",
		Config:   map[string]any{"rpc_url": server.URL},
	}

	result := stellarProber{}.Probe(context.Background(), server.Client(), conn)
	if result.Status != ProbeHealthy {
		t.Fatalf("expected healthy, got %q (%s)", result.Status, result.Message)
	}
}

func TestStellarProber_UnhealthyRPCStatusIsDegraded(t *testing.T) {
	server := fakeSorobanHealthServer(t, "unhealthy", 1000)
	defer server.Close()

	conn := &IntegrationConnection{
		Provider: "stellar",
		Config:   map[string]any{"rpc_url": server.URL},
	}

	result := stellarProber{}.Probe(context.Background(), server.Client(), conn)
	if result.Status != ProbeDegraded {
		t.Fatalf("expected degraded, got %q", result.Status)
	}
}

func TestStellarProber_MissingRPCURLIsUnhealthy(t *testing.T) {
	conn := &IntegrationConnection{Provider: "stellar"}
	result := stellarProber{}.Probe(context.Background(), http.DefaultClient, conn)
	if result.Status != ProbeUnhealthy {
		t.Fatalf("expected unhealthy, got %q", result.Status)
	}
}

func TestStellarProber_UnreachableIsUnhealthy(t *testing.T) {
	server := fakeSorobanHealthServer(t, "healthy", 1000)
	rpcURL := server.URL
	server.Close()

	conn := &IntegrationConnection{
		Provider: "stellar",
		Config:   map[string]any{"rpc_url": rpcURL},
	}

	result := stellarProber{}.Probe(context.Background(), http.DefaultClient, conn)
	if result.Status != ProbeUnhealthy {
		t.Fatalf("expected unhealthy, got %q", result.Status)
	}
}

// --- TestConnection (service-level) ---

func TestTestConnection_HealthyProbeRecordsHealthAndReturnsNil(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	repo := &mockRepository{connection: &IntegrationConnection{
		ID:          "conn-1",
		Provider:    "stripe",
		Credentials: map[string]any{"api_key": "sk_test_123"},
		Config:      map[string]any{"base_url": server.URL},
	}}
	service := NewService(repo, testKeyring())
	service.HTTPClient = server.Client()

	if err := service.TestConnection(context.Background(), "conn-1"); err != nil {
		t.Fatalf("expected nil error for a healthy probe, got %v", err)
	}
	if repo.recordedHealth == nil {
		t.Fatal("expected health to be recorded")
	}
	if repo.recordedHealth.Status != string(ProbeHealthy) {
		t.Errorf("expected healthy status, got %q", repo.recordedHealth.Status)
	}
	if repo.connection.LastTested == nil {
		t.Error("expected LastTested to be set")
	}
}

func TestTestConnection_UnhealthyProbeReturnsError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	repo := &mockRepository{connection: &IntegrationConnection{
		ID:          "conn-1",
		Provider:    "stripe",
		Credentials: map[string]any{"api_key": "sk_bad"},
		Config:      map[string]any{"base_url": server.URL},
	}}
	service := NewService(repo, testKeyring())
	service.HTTPClient = server.Client()

	err := service.TestConnection(context.Background(), "conn-1")
	if err == nil {
		t.Fatal("expected an error for an unhealthy probe")
	}
	if repo.recordedHealth.Status != string(ProbeUnhealthy) {
		t.Errorf("expected unhealthy status recorded, got %q", repo.recordedHealth.Status)
	}
}

func TestTestConnection_UnsupportedProviderReturnsErrorWithoutRecordingHealth(t *testing.T) {
	repo := &mockRepository{connection: &IntegrationConnection{
		ID:       "conn-1",
		Provider: "unknown-provider",
	}}
	service := NewService(repo, testKeyring())

	err := service.TestConnection(context.Background(), "conn-1")
	if err == nil {
		t.Fatal("expected an error for an unsupported provider")
	}
	if repo.recordedHealth != nil {
		t.Error("expected no health record for a provider that was never probed")
	}
}
