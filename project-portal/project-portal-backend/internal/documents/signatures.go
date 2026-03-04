package documents

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/pkg/security"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// VerifySignatureResult is returned to API callers after a verification run.
type VerifySignatureResult struct {
	DocumentID  uuid.UUID                `json:"document_id"`
	Signatures  []security.SignatureInfo `json:"signatures"`
	AllValid    bool                     `json:"all_valid"`
	SignedCount int                      `json:"signed_count"`
	VerifiedAt  time.Time                `json:"verified_at"`
}

// VerifySignature downloads the document from S3, runs cryptographic signature
// verification, persists each result to document_signatures, and records an audit log.
func (s *Service) VerifySignature(ctx context.Context, docID uuid.UUID, userID *uuid.UUID, ipAddr, ua string) (*VerifySignatureResult, error) {
	// 1. Resolve document record.
	doc, err := s.repo.FindByID(ctx, docID)
	if err != nil {
		return nil, fmt.Errorf("document not found: %w", err)
	}
	if doc.FileType != FileTypePDF {
		return nil, fmt.Errorf("signature verification only supported for PDF documents (got %s)", doc.FileType)
	}

	// 2. Download PDF bytes from S3.
	pdfBytes, err := s.storage.DownloadBytes(ctx, doc.S3Key)
	if err != nil {
		return nil, fmt.Errorf("failed to download document for verification: %w", err)
	}

	// 3. Run cryptographic verification.
	vResult, err := security.VerifyPDFSignatures(pdfBytes)
	if err != nil {
		return nil, fmt.Errorf("signature verification failed: %w", err)
	}

	// 4. Persist each signature result.
	for _, sig := range vResult.Signatures {
		details := buildVerificationDetails(sig)
		dbSig := &DocumentSignature{
			ID:                  uuid.New(),
			DocumentID:          docID,
			SignerName:          sig.SignerName,
			SignerEmail:         sig.SignerEmail,
			SignerRole:          sig.SignerRole,
			CertificateIssuer:   sig.CertificateIssuer,
			CertificateSubject:  sig.CertificateSubject,
			SigningTime:         sig.SigningTime,
			IsValid:             sig.IsValid,
			VerificationDetails: details,
			VerifiedAt:          time.Now().UTC(),
		}
		if err := s.repo.CreateSignature(ctx, dbSig); err != nil {
			fmt.Printf("WARNING: failed to persist signature for document %s: %v\n", docID, err)
		}
	}

	// 5. Audit log.
	_ = s.repo.LogAccess(ctx, &DocumentAccessLog{
		DocumentID:  docID,
		UserID:      userID,
		Action:      ActionVerifySignature,
		IPAddress:   ipAddr,
		UserAgent:   ua,
		PerformedAt: time.Now().UTC(),
	})

	return &VerifySignatureResult{
		DocumentID:  docID,
		Signatures:  vResult.Signatures,
		AllValid:    vResult.AllValid,
		SignedCount: vResult.SignedCount,
		VerifiedAt:  vResult.VerifiedAt,
	}, nil
}

// buildVerificationDetails encodes a SignatureInfo into JSONB for storage.
func buildVerificationDetails(sig security.SignatureInfo) datatypes.JSON {
	detail := map[string]interface{}{
		"is_valid":            sig.IsValid,
		"failure_reason":      sig.FailureReason,
		"certificate_issuer":  sig.CertificateIssuer,
		"certificate_subject": sig.CertificateSubject,
	}
	raw, err := json.Marshal(detail)
	if err != nil {
		return datatypes.JSON("{}")
	}
	return datatypes.JSON(raw)
}
