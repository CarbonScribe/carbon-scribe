package documents

import (
	"context"
	"io"

	"carbon-scribe/project-portal/project-portal-backend/pkg/security"
)

type SignatureService struct {
	validator security.Validator
}

func NewSignatureService(validator security.Validator) *SignatureService {
	return &SignatureService{
		validator: validator,
	}
}

func (s *SignatureService) VerifyPDDSignature(ctx context.Context, pdf io.Reader) ([]security.SignatureInfo, error) {
	return s.validator.ValidatePDF(ctx, pdf)
}
