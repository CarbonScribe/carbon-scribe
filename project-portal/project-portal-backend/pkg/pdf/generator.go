package pdf

import (
	"context"
	"io"
)

type Generator interface {
	Generate(ctx context.Context, templateID string, data interface{}) (io.ReadSeeker, error)
	AddWatermark(ctx context.Context, pdf io.Reader, text string) (io.ReadSeeker, error)
}

type mockGenerator struct{}

func NewGenerator() Generator {
	return &mockGenerator{}
}

func (g *mockGenerator) Generate(ctx context.Context, templateID string, data interface{}) (io.ReadSeeker, error) {
	return nil, nil // Return mock reader in real implementation
}

func (g *mockGenerator) AddWatermark(ctx context.Context, pdf io.Reader, text string) (io.ReadSeeker, error) {
	return nil, nil
}
