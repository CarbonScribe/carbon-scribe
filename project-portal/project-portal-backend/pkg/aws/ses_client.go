package aws

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math"
	"net/mail"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	"github.com/aws/aws-sdk-go-v2/service/sesv2/types"
)

// SESConfig holds credentials and overrides for the SES client.
type SESConfig struct {
	Region          string
	AccessKeyID     string
	SecretAccessKey string
	Endpoint        string // Optional: for local SES emulators (e.g. LocalStack)
	FromAddress     string // Required: a verified SES sender identity
}

// EmailClient is the capability set consumers need to send transactional
// email. Satisfied by *SESClient in production; mock for tests.
type EmailClient interface {
	SendEmail(ctx context.Context, to, subject, htmlBody, textBody string) error
}

// SESAPI defines the exact SES SDK client methods we use. This interface
// allows for full mocking during unit testing.
type SESAPI interface {
	SendEmail(ctx context.Context, params *sesv2.SendEmailInput, optFns ...func(*sesv2.Options)) (*sesv2.SendEmailOutput, error)
}

// SESClient wraps the AWS SES v2 SDK client.
type SESClient struct {
	client      SESAPI
	fromAddress string
	maxRetries  int
	backoffBase time.Duration
}

// Verify that *SESClient implements EmailClient.
var _ EmailClient = (*SESClient)(nil)

// NewSESClient initializes a production-ready SESClient using AWS SDK v2.
// cfg.FromAddress is required and must be a syntactically valid email
// address (the underlying identity still has to be verified in SES itself —
// see the "SES Email Delivery" section of README.md).
func NewSESClient(cfg SESConfig) (*SESClient, error) {
	fromAddress, err := validateFromAddress(cfg.FromAddress)
	if err != nil {
		return nil, err
	}

	opts := []func(*config.LoadOptions) error{
		config.WithRegion(cfg.Region),
	}

	if cfg.AccessKeyID != "" && cfg.SecretAccessKey != "" {
		opts = append(opts, config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		))
	}

	awsCfg, err := config.LoadDefaultConfig(context.Background(), opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS SES config: %w", err)
	}

	var sesClientOpts []func(*sesv2.Options)
	if cfg.Endpoint != "" {
		sesClientOpts = append(sesClientOpts, func(o *sesv2.Options) {
			o.BaseEndpoint = aws.String(cfg.Endpoint)
		})
	}

	client := sesv2.NewFromConfig(awsCfg, sesClientOpts...)

	return &SESClient{
		client:      client,
		fromAddress: fromAddress,
		maxRetries:  3,
		backoffBase: 200 * time.Millisecond,
	}, nil
}

// validateFromAddress trims and validates a sender address, returning a
// clear error message suitable for a fail-fast startup check.
func validateFromAddress(from string) (string, error) {
	if from == "" {
		return "", errors.New("SES_FROM_ADDRESS is required")
	}
	addr, err := mail.ParseAddress(from)
	if err != nil {
		return "", fmt.Errorf("SES_FROM_ADDRESS %q is not a valid email address: %w", from, err)
	}
	return addr.Address, nil
}

// SendEmail sends a single formatted email via SES, retrying transient
// throttling/service errors with exponential backoff. Permanent rejections
// (invalid recipient content, suspended account, unverified identity, etc.)
// are never retried.
func (c *SESClient) SendEmail(ctx context.Context, to, subject, htmlBody, textBody string) error {
	if _, err := mail.ParseAddress(to); err != nil {
		return fmt.Errorf("invalid recipient address %q: %w", to, err)
	}

	input := &sesv2.SendEmailInput{
		FromEmailAddress: aws.String(c.fromAddress),
		Destination: &types.Destination{
			ToAddresses: []string{to},
		},
		Content: &types.EmailContent{
			Simple: &types.Message{
				Subject: &types.Content{Data: aws.String(subject), Charset: aws.String("UTF-8")},
				Body: &types.Body{
					Html: &types.Content{Data: aws.String(htmlBody), Charset: aws.String("UTF-8")},
					Text: &types.Content{Data: aws.String(textBody), Charset: aws.String("UTF-8")},
				},
			},
		},
	}

	_, err := c.executeWithRetry(ctx, "SendEmail", func() (interface{}, error) {
		return c.client.SendEmail(ctx, input)
	})
	return err
}

// executeWithRetry wraps an SES call with exponential backoff, retrying only
// transient throttling/service errors.
func (c *SESClient) executeWithRetry(ctx context.Context, opName string, fn func() (interface{}, error)) (interface{}, error) {
	var lastErr error
	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(math.Pow(2, float64(attempt))) * c.backoffBase
			log.Printf("[SES] %s: attempt %d failed, retrying in %v. Error: %v", opName, attempt, backoff, lastErr)
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
			}
		}

		res, err := fn()
		if err == nil {
			return res, nil
		}
		lastErr = err

		if !isRetryableSESError(err) {
			break
		}
	}
	return nil, fmt.Errorf("%s failed after %d retries: %w", opName, c.maxRetries, lastErr)
}

// isRetryableSESError reports whether err represents a transient condition
// (throttling, transient service fault, or account sending-rate limit)
// worth retrying, as opposed to a permanent rejection.
func isRetryableSESError(err error) bool {
	var throttling *types.TooManyRequestsException
	var limitExceeded *types.LimitExceededException
	var internalErr *types.InternalServiceErrorException
	return errors.As(err, &throttling) || errors.As(err, &limitExceeded) || errors.As(err, &internalErr)
}
