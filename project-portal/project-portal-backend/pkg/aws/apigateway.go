package aws

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/apigatewaymanagementapi"
)

type APIGatewayConfig struct {
	Region          string
	AccessKeyID     string
	SecretAccessKey string
	Endpoint        string // e.g. https://{id}.execute-api.{region}.amazonaws.com/{stage}
}

type APIGatewayClient struct {
	Client *apigatewaymanagementapi.Client
}

func NewAPIGatewayClient(cfg APIGatewayConfig) (*APIGatewayClient, error) {
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
		return nil, fmt.Errorf("failed to load AWS config for API Gateway: %w", err)
	}

	client := apigatewaymanagementapi.NewFromConfig(awsCfg, func(o *apigatewaymanagementapi.Options) {
		if cfg.Endpoint != "" {
			o.BaseEndpoint = aws.String(cfg.Endpoint)
		}
	})

	return &APIGatewayClient{Client: client}, nil
}

func (s *APIGatewayClient) PostToConnection(ctx context.Context, connectionID string, data []byte) error {
	_, err := s.Client.PostToConnection(ctx, &apigatewaymanagementapi.PostToConnectionInput{
		ConnectionId: aws.String(connectionID),
		Data:         data,
	})
	return err
}
