package aws

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	"github.com/aws/aws-sdk-go-v2/service/sesv2/types"
	"github.com/stretchr/testify/assert"
)

// MockSESAPI implements SESAPI for unit testing.
type MockSESAPI struct {
	SendEmailFunc func(ctx context.Context, params *sesv2.SendEmailInput, optFns ...func(*sesv2.Options)) (*sesv2.SendEmailOutput, error)
	CallCount     int
}

func (m *MockSESAPI) SendEmail(ctx context.Context, params *sesv2.SendEmailInput, optFns ...func(*sesv2.Options)) (*sesv2.SendEmailOutput, error) {
	m.CallCount++
	if m.SendEmailFunc != nil {
		return m.SendEmailFunc(ctx, params, optFns...)
	}
	return &sesv2.SendEmailOutput{}, nil
}

func newTestSESClient(mock *MockSESAPI) *SESClient {
	return &SESClient{
		client:      mock,
		fromAddress: "no-reply@carbonscribe.test",
		maxRetries:  3,
		backoffBase: time.Millisecond, // keep tests fast
	}
}

func TestNewSESClient_RequiresFromAddress(t *testing.T) {
	_, err := NewSESClient(SESConfig{Region: "us-east-1"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "SES_FROM_ADDRESS")
}

func TestNewSESClient_RejectsInvalidFromAddress(t *testing.T) {
	_, err := NewSESClient(SESConfig{Region: "us-east-1", FromAddress: "not-an-email"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not a valid email address")
}

func TestNewSESClient_AcceptsValidFromAddress(t *testing.T) {
	client, err := NewSESClient(SESConfig{Region: "us-east-1", FromAddress: "no-reply@carbonscribe.test"})
	assert.NoError(t, err)
	assert.NotNil(t, client)
	assert.Equal(t, "no-reply@carbonscribe.test", client.fromAddress)
}

func TestSendEmail_Success(t *testing.T) {
	mock := &MockSESAPI{}
	client := newTestSESClient(mock)

	err := client.SendEmail(context.Background(), "user@example.com", "Subject", "<p>html</p>", "text")
	assert.NoError(t, err)
	assert.Equal(t, 1, mock.CallCount)
}

func TestSendEmail_RejectsInvalidRecipient(t *testing.T) {
	mock := &MockSESAPI{}
	client := newTestSESClient(mock)

	err := client.SendEmail(context.Background(), "not-an-email", "Subject", "html", "text")
	assert.Error(t, err)
	assert.Equal(t, 0, mock.CallCount, "SES should never be called for an invalid recipient")
}

func TestSendEmail_RetriesThrottlingThenSucceeds(t *testing.T) {
	attempts := 0
	mock := &MockSESAPI{
		SendEmailFunc: func(ctx context.Context, params *sesv2.SendEmailInput, optFns ...func(*sesv2.Options)) (*sesv2.SendEmailOutput, error) {
			attempts++
			if attempts < 3 {
				return nil, &types.TooManyRequestsException{Message: aws.String("throttled")}
			}
			return &sesv2.SendEmailOutput{}, nil
		},
	}
	client := newTestSESClient(mock)

	err := client.SendEmail(context.Background(), "user@example.com", "Subject", "html", "text")
	assert.NoError(t, err)
	assert.Equal(t, 3, attempts)
}

func TestSendEmail_ThrottlingExhaustsRetries(t *testing.T) {
	mock := &MockSESAPI{
		SendEmailFunc: func(ctx context.Context, params *sesv2.SendEmailInput, optFns ...func(*sesv2.Options)) (*sesv2.SendEmailOutput, error) {
			return nil, &types.TooManyRequestsException{Message: aws.String("throttled")}
		},
	}
	client := newTestSESClient(mock)

	err := client.SendEmail(context.Background(), "user@example.com", "Subject", "html", "text")
	assert.Error(t, err)
	assert.Equal(t, client.maxRetries+1, mock.CallCount)
}

func TestSendEmail_RejectionIsNotRetried(t *testing.T) {
	mock := &MockSESAPI{
		SendEmailFunc: func(ctx context.Context, params *sesv2.SendEmailInput, optFns ...func(*sesv2.Options)) (*sesv2.SendEmailOutput, error) {
			return nil, &types.MessageRejected{Message: aws.String("content rejected")}
		},
	}
	client := newTestSESClient(mock)

	err := client.SendEmail(context.Background(), "user@example.com", "Subject", "html", "text")
	assert.Error(t, err)
	assert.Equal(t, 1, mock.CallCount, "a permanent rejection must not be retried")
}

func TestSendEmail_GenericErrorIsNotRetried(t *testing.T) {
	mock := &MockSESAPI{
		SendEmailFunc: func(ctx context.Context, params *sesv2.SendEmailInput, optFns ...func(*sesv2.Options)) (*sesv2.SendEmailOutput, error) {
			return nil, errors.New("boom")
		},
	}
	client := newTestSESClient(mock)

	err := client.SendEmail(context.Background(), "user@example.com", "Subject", "html", "text")
	assert.Error(t, err)
	assert.Equal(t, 1, mock.CallCount)
}

func TestSendEmail_UsesConfiguredFromAddress(t *testing.T) {
	var captured *sesv2.SendEmailInput
	mock := &MockSESAPI{
		SendEmailFunc: func(ctx context.Context, params *sesv2.SendEmailInput, optFns ...func(*sesv2.Options)) (*sesv2.SendEmailOutput, error) {
			captured = params
			return &sesv2.SendEmailOutput{}, nil
		},
	}
	client := newTestSESClient(mock)

	err := client.SendEmail(context.Background(), "user@example.com", "Hello", "<p>hi</p>", "hi")
	assert.NoError(t, err)
	assert.NotNil(t, captured)
	assert.Equal(t, "no-reply@carbonscribe.test", *captured.FromEmailAddress)
	assert.Equal(t, []string{"user@example.com"}, captured.Destination.ToAddresses)
	assert.Equal(t, "Hello", *captured.Content.Simple.Subject.Data)
	assert.Equal(t, "<p>hi</p>", *captured.Content.Simple.Body.Html.Data)
	assert.Equal(t, "hi", *captured.Content.Simple.Body.Text.Data)
}
