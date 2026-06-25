package channels

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMockSMSSender(t *testing.T) {
	sender := &MockSMSSender{}

	t.Run("success send", func(t *testing.T) {
		msgID, err := sender.Send(context.Background(), "+1234567890", "Test message")
		assert.NoError(t, err)
		assert.Contains(t, msgID, "mock-msg-id-")
	})

	t.Run("missing recipient number", func(t *testing.T) {
		_, err := sender.Send(context.Background(), "", "Test message")
		assert.Error(t, err)
		assert.Equal(t, "recipient phone number is required", err.Error())
	})

	t.Run("invalid recipient number error", func(t *testing.T) {
		_, err := sender.Send(context.Background(), "invalid-number", "Test message")
		assert.Error(t, err)
		assert.Equal(t, "invalid phone number", err.Error())
	})
}

func TestTwilioSender(t *testing.T) {
	t.Run("invalid config", func(t *testing.T) {
		sender := NewTwilioSender("", "", "")
		_, err := sender.Send(context.Background(), "+1234567890", "Hello")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "credentials or from number not configured")
	})

	t.Run("successful api call", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "application/x-www-form-urlencoded", r.Header.Get("Content-Type"))
			username, password, ok := r.BasicAuth()
			assert.True(t, ok)
			assert.Equal(t, "ACxxxxxx", username)
			assert.Equal(t, "auth_token_secret", password)

			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"sid": "SM123456", "status": "queued"}`))
		}))
		defer server.Close()

		sender := NewTwilioSender("ACxxxxxx", "auth_token_secret", "+188888888")
		// Point to local test server
		originalTransport := sender.httpClient.Transport
		defer func() { sender.httpClient.Transport = originalTransport }()

		sender.httpClient.Transport = &mockRoundTripper{
			roundTrip: func(req *http.Request) (*http.Response, error) {
				// Rewrite destination to point to the local test server
				req.URL.Scheme = "http"
				req.URL.Host = server.Listener.Addr().String()
				return http.DefaultTransport.RoundTrip(req)
			},
		}

		msgID, err := sender.Send(context.Background(), "+1234567890", "Hello Twilio")
		assert.NoError(t, err)
		assert.Equal(t, "twilio-msg-id-ok", msgID)
	})

	t.Run("failed api call", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"message": "Invalid number"}`))
		}))
		defer server.Close()

		sender := NewTwilioSender("ACxxxxxx", "auth_token_secret", "+188888888")
		sender.httpClient.Transport = &mockRoundTripper{
			roundTrip: func(req *http.Request) (*http.Response, error) {
				req.URL.Scheme = "http"
				req.URL.Host = server.Listener.Addr().String()
				return http.DefaultTransport.RoundTrip(req)
			},
		}

		_, err := sender.Send(context.Background(), "+1234567890", "Hello Twilio")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "twilio API returned status 400")
	})
}

type mockRoundTripper struct {
	roundTrip func(*http.Request) (*http.Response, error)
}

func (m *mockRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return m.roundTrip(req)
}
