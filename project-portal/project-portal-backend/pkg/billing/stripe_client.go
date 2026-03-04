package billing

import "context"

type StripeClient interface {
	CreatePaymentMethod(ctx context.Context, token string) (string, error)
}

type NoopStripeClient struct{}

func (NoopStripeClient) CreatePaymentMethod(ctx context.Context, token string) (string, error) {
	return token, nil
}
