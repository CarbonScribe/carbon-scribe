package storage

import (
	"context"
	"io"
)

type IPFSClient interface {
	PinFile(ctx context.Context, body io.Reader) (string, error)
	UnpinFile(ctx context.Context, cid string) error
}

// mockIPFSClient for demonstration/initial implementation
type mockIPFSClient struct{}

func NewIPFSClient() IPFSClient {
	return &mockIPFSClient{}
}

func (c *mockIPFSClient) PinFile(ctx context.Context, body io.Reader) (string, error) {
	return "QmMockCID123456789", nil
}

func (c *mockIPFSClient) UnpinFile(ctx context.Context, cid string) error {
	return nil
}
