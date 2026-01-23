package documents

import (
	"context"
	"io"

	"carbon-scribe/project-portal/project-portal-backend/pkg/pdf"
)

type PDFService struct {
	generator pdf.Generator
}

func NewPDFService(generator pdf.Generator) *PDFService {
	return &PDFService{
		generator: generator,
	}
}

func (s *PDFService) GenerateReport(ctx context.Context, templateID string, data interface{}) (io.ReadSeeker, error) {
	return s.generator.Generate(ctx, templateID, data)
}

func (s *PDFService) WatermarkDocument(ctx context.Context, pdf io.Reader, text string) (io.ReadSeeker, error) {
	return s.generator.AddWatermark(ctx, pdf, text)
}
