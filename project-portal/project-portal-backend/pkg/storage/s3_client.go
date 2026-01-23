package storage

import (
	"context"
	"io"
	"time"
)

type S3Client interface {
	Upload(ctx context.Context, bucket, key string, body io.Reader) error
	Download(ctx context.Context, bucket, key string) (io.ReadCloser, error)
	Delete(ctx context.Context, bucket, key string) error
	GetPresignedURL(ctx context.Context, bucket, key string, expiration time.Duration) (string, error)
}

// mockS3Client for demonstration/initial implementation
type mockS3Client struct{}

func NewS3Client() S3Client {
	return &mockS3Client{}
}

func (c *mockS3Client) Upload(ctx context.Context, bucket, key string, body io.Reader) error {
	return nil
}

func (c *mockS3Client) Download(ctx context.Context, bucket, key string) (io.ReadCloser, error) {
	return nil, nil
}

func (c *mockS3Client) Delete(ctx context.Context, bucket, key string) error {
	return nil
}

func (c *mockS3Client) GetPresignedURL(ctx context.Context, bucket, key string, expiration time.Duration) (string, error) {
	return "https://mock-s3-url.com/" + key, nil
}
