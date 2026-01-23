package security

import (
	"context"
	"io"
	"time"
)

type SignatureInfo struct {
	SignerName        string
	SignerRole        string
	CertificateIssuer string
	SigningTime       time.Time
	IsValid           bool
	Details           map[string]interface{}
}

type Validator interface {
	ValidatePDF(ctx context.Context, pdf io.Reader) ([]SignatureInfo, error)
}

type mockValidator struct{}

func NewValidator() Validator {
	return &mockValidator{}
}

func (v *mockValidator) ValidatePDF(ctx context.Context, pdf io.Reader) ([]SignatureInfo, error) {
	return []SignatureInfo{
		{
			SignerName:        "John Doe",
			SignerRole:        "Verifier",
			CertificateIssuer: "CarbonScribe CA",
			SigningTime:       time.Now(),
			IsValid:           true,
			Details:           map[string]interface{}{"algorithm": "RSA-SHA256"},
		},
	}, nil
}
