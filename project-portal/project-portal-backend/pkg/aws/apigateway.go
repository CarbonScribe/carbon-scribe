package aws

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
)

// APIGatewayConfig holds configuration for API Gateway client.
type APIGatewayConfig struct {
	Region          string
	AccessKeyID     string
	SecretAccessKey string
	Endpoint        string
	Stage           string
}

// APIGatewayClient manages interactions with AWS API Gateway's WebSocket API.
type APIGatewayClient struct {
	httpClient *http.Client
	endpoint   string
}

// NewAPIGatewayClient creates a new API Gateway WebSocket client.
func NewAPIGatewayClient(cfg APIGatewayConfig) (*APIGatewayClient, error) {
	opts := []func(*config.LoadOptions) error{
		config.WithRegion(cfg.Region),
	}

	if cfg.AccessKeyID != "" && cfg.SecretAccessKey != "" {
		opts = append(opts, config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		))
	}

	_, err := config.LoadDefaultConfig(context.Background(), opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	endpoint := cfg.Endpoint
	if cfg.Stage != "" && endpoint != "" {
		endpoint = fmt.Sprintf("%s/%s", endpoint, cfg.Stage)
	}

	return &APIGatewayClient{
		httpClient: &http.Client{Timeout: 10},
		endpoint:   endpoint,
	}, nil
}

// PostToConnection sends a message to a specific WebSocket connection.
func (c *APIGatewayClient) PostToConnection(ctx context.Context, connectionID string, data interface{}) error {
	if c.endpoint == "" {
		return fmt.Errorf("API Gateway endpoint not configured")
	}
	if connectionID == "" {
		return fmt.Errorf("connection ID is required")
	}

	payload, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	url := fmt.Sprintf("%s/@connections/%s", c.endpoint, connectionID)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(payload))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send message: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("API Gateway returned status %d", resp.StatusCode)
	}

	return nil
}

// DeleteConnection closes a specific WebSocket connection.
func (c *APIGatewayClient) DeleteConnection(ctx context.Context, connectionID string) error {
	if c.endpoint == "" {
		return fmt.Errorf("API Gateway endpoint not configured")
	}
	if connectionID == "" {
		return fmt.Errorf("connection ID is required")
	}

	url := fmt.Sprintf("%s/@connections/%s", c.endpoint, connectionID)
	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete connection: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("API Gateway returned status %d", resp.StatusCode)
	}

	return nil
}
