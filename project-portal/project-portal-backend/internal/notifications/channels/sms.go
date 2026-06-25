package channels

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/pkg/aws"
)

// SMSSender defines the interface for sending SMS notifications.
type SMSSender interface {
	Send(ctx context.Context, to string, body string) (string, error)
}

// MockSMSSender is a mock provider for local development and unit tests.
type MockSMSSender struct{}

func (m *MockSMSSender) Send(ctx context.Context, to string, body string) (string, error) {
	if to == "" {
		return "", errors.New("recipient phone number is required")
	}
	if strings.Contains(to, "invalid") || strings.Contains(to, "fail") {
		return "", errors.New("invalid phone number")
	}
	return "mock-msg-id-" + fmt.Sprintf("%d", time.Now().UnixNano()), nil
}

// AWSSNSSender sends SMS using AWS SNS.
type AWSSNSSender struct {
	client *aws.SNSClient
}

func NewAWSSNSSender(cfg aws.SNSConfig) (*AWSSNSSender, error) {
	client, err := aws.NewSNSClient(cfg)
	if err != nil {
		return nil, err
	}
	return &AWSSNSSender{client: client}, nil
}

func (a *AWSSNSSender) Send(ctx context.Context, to string, body string) (string, error) {
	return a.client.PublishSMS(ctx, to, body)
}

// TwilioSender sends SMS using Twilio HTTP API.
type TwilioSender struct {
	accountSID string
	authToken  string
	fromNumber string
	httpClient *http.Client
}

func NewTwilioSender(accountSID, authToken, fromNumber string) *TwilioSender {
	return &TwilioSender{
		accountSID: accountSID,
		authToken:  authToken,
		fromNumber: fromNumber,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (t *TwilioSender) Send(ctx context.Context, to string, body string) (string, error) {
	if t.accountSID == "" || t.authToken == "" || t.fromNumber == "" {
		return "", errors.New("twilio credentials or from number not configured")
	}

	apiURL := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", t.accountSID)

	data := url.Values{}
	data.Set("To", to)
	data.Set("From", t.fromNumber)
	data.Set("Body", body)

	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, strings.NewReader(data.Encode()))
	if err != nil {
		return "", err
	}

	req.SetBasicAuth(t.accountSID, t.authToken)
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded")

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("twilio API returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	return "twilio-msg-id-ok", nil
}
