package minting

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

// fakeGetNetworkServer serves a minimal JSON-RPC 2.0 getNetwork response —
// enough for rpcclient.Client.GetNetwork to parse — always reporting
// passphrase regardless of the request.
func fakeGetNetworkServer(t *testing.T, passphrase string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			ID any `json:"id"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"jsonrpc": "2.0",
			"id":      req.ID,
			"result": map[string]any{
				"passphrase":      passphrase,
				"protocolVersion": 21,
			},
		})
	}))
}

// #794: Validate that the passphrase matches the RPC (query getNetwork on
// the RPC at startup and compare passphrases).
func TestValidateNetworkConfig_MatchingPassphrasePasses(t *testing.T) {
	server := fakeGetNetworkServer(t, "Test SDF Network ; September 2015")
	defer server.Close()

	err := ValidateNetworkConfig(context.Background(), server.URL, "Test SDF Network ; September 2015")
	assert.NoError(t, err)
}

func TestValidateNetworkConfig_MismatchedPassphraseFails(t *testing.T) {
	server := fakeGetNetworkServer(t, "Public Global Stellar Network ; September 2015")
	defer server.Close()

	err := ValidateNetworkConfig(context.Background(), server.URL, "Test SDF Network ; September 2015")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "does not match")
}

func TestValidateNetworkConfig_UnreachableRPCFails(t *testing.T) {
	err := ValidateNetworkConfig(context.Background(), "http://127.0.0.1:1", "Test SDF Network ; September 2015")
	assert.Error(t, err)
}
