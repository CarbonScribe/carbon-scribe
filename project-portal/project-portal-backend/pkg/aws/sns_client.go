package aws

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/sns"
)

type SNSConfig struct {
	Region          string
	AccessKeyID     string
	SecretAccessKey string
}

type SNSClient struct {
	Client *sns.Client
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
		return nil, fmt.Errorf("failed to load AWS config for SNS: %w", err)
	}

	client := sns.NewFromConfig(awsCfg)
	return &SNSClient{Client: client}, nil
}

func (s *SNSClient) SendSMS(ctx context.Context, phoneNumber, message string) (string, error) {
	input := &sns.PublishInput{
		PhoneNumber: aws.String(phoneNumber),
		Message:     aws.String(message),
	}

	result, err := s.Client.Publish(ctx, input)
	if err != nil {
		return "", err
	}
	return aws.ToString(result.MessageId), nil
}
