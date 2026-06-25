package aws

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	"github.com/aws/aws-sdk-go-v2/service/sns/types"
)

type SNSConfig struct {
	Region          string
	AccessKeyID     string
	SecretAccessKey string
	Endpoint        string
	SenderID        string
}

type SNSClient struct {
	client   *sns.Client
	senderID string
}

func NewSNSClient(cfg SNSConfig) (*SNSClient, error) {
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
		return nil, fmt.Errorf("failed to load AWS SNS config: %w", err)
	}

	var snsClientOpts []func(*sns.Options)
	if cfg.Endpoint != "" {
		snsClientOpts = append(snsClientOpts, func(o *sns.Options) {
			o.BaseEndpoint = aws.String(cfg.Endpoint)
		})
	}

	client := sns.NewFromConfig(awsCfg, snsClientOpts...)
	return &SNSClient{
		client:   client,
		senderID: cfg.SenderID,
	}, nil
}

func (s *SNSClient) PublishSMS(ctx context.Context, to string, message string) (string, error) {
	input := &sns.PublishInput{
		Message:     aws.String(message),
		PhoneNumber: aws.String(to),
	}

	attributes := make(map[string]types.MessageAttributeValue)
	if s.senderID != "" {
		attributes["AWS.SNS.SMS.SenderID"] = types.MessageAttributeValue{
			DataType:    aws.String("String"),
			StringValue: aws.String(s.senderID),
		}
	}
	// Default to transactional for alert delivery reliability
	attributes["AWS.SNS.SMS.SMSType"] = types.MessageAttributeValue{
		DataType:    aws.String("String"),
		StringValue: aws.String("Transactional"),
	}
	input.MessageAttributes = attributes

	out, err := s.client.Publish(ctx, input)
	if err != nil {
		return "", fmt.Errorf("failed to publish SNS SMS: %w", err)
	}
	if out.MessageId == nil {
		return "", fmt.Errorf("publish response missing message ID")
	}
	return *out.MessageId, nil
}
