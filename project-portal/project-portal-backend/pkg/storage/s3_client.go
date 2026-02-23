package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// S3Config holds the configuration for the S3 client.
type S3Config struct {
	Region          string
	AccessKeyID     string
	SecretAccessKey string
	BucketName      string
	Endpoint        string // optional: for LocalStack / MinIO
}

// S3Client wraps the AWS S3 SDK with common document operations.
type S3Client struct {
	client     *s3.Client
	uploader   *manager.Uploader
	downloader *manager.Downloader
	bucket     string
}

// NewS3Client creates a new S3Client from the given config.
func NewS3Client(cfg S3Config) (*S3Client, error) {
	opts := []func(*config.LoadOptions) error{
		config.WithRegion(cfg.Region),
	}

	// Support static credentials when both key fields are set.
	if cfg.AccessKeyID != "" && cfg.SecretAccessKey != "" {
		opts = append(opts, config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		))
	}

	awsCfg, err := config.LoadDefaultConfig(context.Background(), opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	var s3ClientOpts []func(*s3.Options)
	if cfg.Endpoint != "" {
		s3ClientOpts = append(s3ClientOpts, func(o *s3.Options) {
			o.BaseEndpoint = aws.String(cfg.Endpoint)
			o.UsePathStyle = true
		})
	}

	client := s3.NewFromConfig(awsCfg, s3ClientOpts...)
	return &S3Client{
		client:     client,
		uploader:   manager.NewUploader(client),
		downloader: manager.NewDownloader(client),
		bucket:     cfg.BucketName,
	}, nil
}

// UploadResult contains the outcome of an S3 upload.
type UploadResult struct {
	Key      string
	Bucket   string
	Location string
	ETag     string
}

// Upload streams content directly to S3 without buffering the whole file.
func (s *S3Client) Upload(ctx context.Context, key string, body io.Reader, contentType string) (*UploadResult, error) {
	result, err := s.uploader.Upload(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        body,
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return nil, fmt.Errorf("s3 upload failed for key %q: %w", key, err)
	}
	return &UploadResult{
		Key:      key,
		Bucket:   s.bucket,
		Location: result.Location,
		ETag:     aws.ToString(result.ETag),
	}, nil
}

// Download fetches an object from S3 and returns its bytes.
func (s *S3Client) Download(ctx context.Context, key string) ([]byte, error) {
	buf := manager.NewWriteAtBuffer([]byte{})
	_, err := s.downloader.Download(ctx, buf, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("s3 download failed for key %q: %w", key, err)
	}
	return buf.Bytes(), nil
}

// DownloadStream returns a ReadCloser for streaming large files.
func (s *S3Client) DownloadStream(ctx context.Context, key string) (io.ReadCloser, int64, error) {
	result, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, 0, fmt.Errorf("s3 get object failed for key %q: %w", key, err)
	}
	size := int64(0)
	if result.ContentLength != nil {
		size = *result.ContentLength
	}
	return result.Body, size, nil
}

// Delete removes an object from S3.
func (s *S3Client) Delete(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("s3 delete failed for key %q: %w", key, err)
	}
	return nil
}

// GeneratePresignedURL creates a time-limited download URL for a document.
func (s *S3Client) GeneratePresignedURL(ctx context.Context, key string, expiry time.Duration) (string, error) {
	presignClient := s3.NewPresignClient(s.client)
	result, err := presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(expiry))
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned URL for key %q: %w", key, err)
	}
	return result.URL, nil
}

// UploadBytes is a convenience wrapper for uploading in-memory content.
func (s *S3Client) UploadBytes(ctx context.Context, key string, data []byte, contentType string) (*UploadResult, error) {
	return s.Upload(ctx, key, bytes.NewReader(data), contentType)
}

// BucketName returns the configured bucket name.
func (s *S3Client) BucketName() string {
	return s.bucket
}
