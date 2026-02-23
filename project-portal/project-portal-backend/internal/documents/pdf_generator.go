package documents

import (
	"bytes"
	"context"
	"fmt"
	"path"
	"strings"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/pkg/pdf"
	"github.com/google/uuid"
)

// GeneratePDFRequest is the JSON body for POST /api/v1/documents/generate-pdf.
type GeneratePDFRequest struct {
	TemplateID  string                 `json:"template_id" binding:"required"`
	ProjectID   string                 `json:"project_id" binding:"required"`
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	Data        map[string]interface{} `json:"data"`
	Watermark   string                 `json:"watermark"` // "DRAFT" | "CONFIDENTIAL" | "APPROVED" | ""
}

// GeneratePDF renders a PDF from a named template, uploads it to S3, and saves a Document record.
func (s *Service) GeneratePDF(ctx context.Context, req *GeneratePDFRequest, userID *uuid.UUID) (*Document, error) {
	// 1. Render PDF bytes via the pkg/pdf template engine.
	pdfBytes, err := pdf.Generate(pdf.GenerateRequest{
		TemplateID: req.TemplateID,
		ProjectID:  req.ProjectID,
		Data:       req.Data,
		Watermark:  pdf.WatermarkText(req.Watermark),
	})
	if err != nil {
		return nil, fmt.Errorf("pdf generation failed: %w", err)
	}

	// 2. Build S3 key.
	pid, err := uuid.Parse(req.ProjectID)
	if err != nil {
		return nil, fmt.Errorf("invalid project_id: %w", err)
	}
	safeTemplate := strings.ToLower(strings.ReplaceAll(req.TemplateID, "_", "-"))
	timestamp := time.Now().UTC().Format("20060102T150405")
	fileName := fmt.Sprintf("%s_%s.pdf", safeTemplate, timestamp)
	s3Key := path.Join("projects", req.ProjectID, "documents", safeTemplate, fileName)

	// 3. Upload bytes to S3.
	result, err := s.storage.UploadReader(ctx, s3Key, bytes.NewReader(pdfBytes), "application/pdf")
	if err != nil {
		return nil, fmt.Errorf("s3 upload failed: %w", err)
	}

	// 4. Persist Document record.
	doc := &Document{
		ID:           uuid.New(),
		ProjectID:    pid,
		Name:         req.Name,
		Description:  req.Description,
		DocumentType: DocumentType(req.TemplateID),
		FileType:     FileTypePDF,
		FileSize:     int64(len(pdfBytes)),
		S3Key:        result.Key,
		S3Bucket:     result.Bucket,
		Status:       DocumentStatusDraft,
		UploadedBy:   userID,
		UploadedAt:   time.Now().UTC(),
	}

	if err := s.repo.Create(ctx, doc); err != nil {
		_ = s.storage.Delete(ctx, s3Key)
		return nil, err
	}

	_ = s.repo.LogAccess(ctx, &DocumentAccessLog{
		DocumentID:  doc.ID,
		UserID:      userID,
		Action:      ActionUpload,
		PerformedAt: time.Now().UTC(),
	})

	return doc, nil
}
