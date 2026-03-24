package aws

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	"github.com/aws/aws-sdk-go-v2/service/sesv2/types"
)

type SESConfig struct {
	Region          string
	AccessKeyID     string
	SecretAccessKey string
}

type SESClient struct {
	Client *sesv2.Client
}

func NewSESClient(cfg SESConfig) (*SESClient, error) {
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
		return nil, fmt.Errorf("failed to load AWS config for SES: %w", err)
	}

	client := sesv2.NewFromConfig(awsCfg)
	return &SESClient{Client: client}, nil
}

func (s *SESClient) SendEmail(ctx context.Context, from, to, subject, body string) (string, error) {
	input := &sesv2.SendEmailInput{
		FromEmailAddress: aws.String(from),
		Destination: &types.Destination{
			ToAddresses: []string{to},
		},
		Content: &types.EmailContent{
			Simple: &types.Message{
				Subject: &types.Content{
					Data: aws.String(subject),
				},
				Body: &types.Body{
					Html: &types.Content{
						Data: aws.String(body),
					},
				},
			},
		},
	}

	result, err := s.Client.SendEmail(ctx, input)
	if err != nil {
		return "", err
	}
	return aws.ToString(result.MessageId), nil
}
