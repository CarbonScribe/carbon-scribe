package documents

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/google/uuid"
	"carbon-scribe/project-portal/project-portal-backend/pkg/security"
)

type Service interface {
	UploadDocument(ctx context.Context, req UploadRequest) (*Document, error)
	GetDocument(ctx context.Context, id uuid.UUID) (*Document, error)
	ListDocuments(ctx context.Context, projectID *uuid.UUID, docType *DocumentType) ([]Document, error)
	DownloadDocument(ctx context.Context, id uuid.UUID) (io.ReadCloser, error)
	DeleteDocument(ctx context.Context, id uuid.UUID) error
	
	UploadNewVersion(ctx context.Context, id uuid.UUID, req VersionRequest) (*DocumentVersion, error)
	ListVersions(ctx context.Context, id uuid.UUID) ([]DocumentVersion, error)
	
	GeneratePDF(ctx context.Context, req GeneratePDFRequest) (*Document, error)
	VerifySignature(ctx context.Context, id uuid.UUID) ([]security.SignatureInfo, error)
	
	GetDocumentVersion(ctx context.Context, id uuid.UUID, version int) (*DocumentVersion, error)
	ExtractText(ctx context.Context, id uuid.UUID) (string, error)
	
	TransitionWorkflow(ctx context.Context, id uuid.UUID, action string, userID uuid.UUID) error
	TransitionStorageTier(ctx context.Context, id uuid.UUID, tier StorageTier) error
}

type UploadRequest struct {
	ProjectID    uuid.UUID
	Name         string
	Description  string
	DocumentType DocumentType
	FileType     FileType
	FileSize     int64
	FileContent  io.Reader
	UploadedBy   uuid.UUID
}

type VersionRequest struct {
	FileContent   io.Reader
	ChangeSummary string
	UploadedBy    uuid.UUID
}

type GeneratePDFRequest struct {
	ProjectID    uuid.UUID
	TemplateID   string
	Data         interface{}
	DocumentType DocumentType
	Name         string
	UploadedBy   uuid.UUID
}

type documentService struct {
	repo      Repository
	storage   *StorageProvider
	pdf       *PDFService
	sig       *SignatureService
	workflow  *WorkflowService
}

func NewService(repo Repository, storage *StorageProvider, pdf *PDFService, sig *SignatureService, workflow *WorkflowService) Service {
	return &documentService{
		repo:     repo,
		storage:  storage,
		pdf:      pdf,
		sig:      sig,
		workflow: workflow,
	}
}

func (s *documentService) UploadDocument(ctx context.Context, req UploadRequest) (*Document, error) {
	docID := uuid.New()
	s3Key := s.storage.GenerateS3Key(req.ProjectID.String(), string(req.DocumentType), req.Name)
	
	// Upload to S3
	if err := s.storage.UploadToS3(ctx, "carbonscribe-docs", s3Key, req.FileContent); err != nil {
		return nil, err
	}
	
	// Optional: Pin to IPFS
	// ipfsCID, _ := s.storage.PinToIPFS(ctx, req.FileContent)

	doc := &Document{
		ID:             docID,
		ProjectID:      req.ProjectID,
		Name:           req.Name,
		Description:    req.Description,
		DocumentType:   req.DocumentType,
		FileType:       req.FileType,
		FileSize:       req.FileSize,
		S3Key:          s3Key,
		S3Bucket:       "carbonscribe-docs",
		StorageTier:    TierHot,
		CurrentVersion: 1,
		Status:         StatusDraft,
		UploadedBy:     req.UploadedBy,
		UploadedAt:     time.Now(),
	}
	
	if err := s.repo.CreateDocument(ctx, doc); err != nil {
		return nil, err
	}
	
	return doc, nil
}

func (s *documentService) GetDocument(ctx context.Context, id uuid.UUID) (*Document, error) {
	return s.repo.GetDocumentByID(ctx, id)
}

func (s *documentService) ListDocuments(ctx context.Context, projectID *uuid.UUID, docType *DocumentType) ([]Document, error) {
	return s.repo.ListDocuments(ctx, projectID, docType)
}

func (s *documentService) DownloadDocument(ctx context.Context, id uuid.UUID) (io.ReadCloser, error) {
	doc, err := s.repo.GetDocumentByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return s.storage.DownloadFromS3(ctx, doc.S3Bucket, doc.S3Key)
}

func (s *documentService) DeleteDocument(ctx context.Context, id uuid.UUID) error {
	_, err := s.repo.GetDocumentByID(ctx, id)
	if err != nil {
		return err
	}
	// Delete from S3 (optional, maybe keep for audit)
	return s.repo.DeleteDocument(ctx, id)
}

func (s *documentService) UploadNewVersion(ctx context.Context, id uuid.UUID, req VersionRequest) (*DocumentVersion, error) {
	doc, err := s.repo.GetDocumentByID(ctx, id)
	if err != nil {
		return nil, err
	}
	
	newVersionNumber := doc.CurrentVersion + 1
	s3Key := s.storage.GenerateS3Key(doc.ProjectID.String(), string(doc.DocumentType), fmt.Sprintf("%s_v%d", doc.Name, newVersionNumber))
	
	if err := s.storage.UploadToS3(ctx, doc.S3Bucket, s3Key, req.FileContent); err != nil {
		return nil, err
	}
	
	version := &DocumentVersion{
		ID:            uuid.New(),
		DocumentID:    id,
		VersionNumber: newVersionNumber,
		S3Key:         s3Key,
		ChangeSummary: req.ChangeSummary,
		UploadedBy:    req.UploadedBy,
		UploadedAt:    time.Now(),
	}
	
	if err := s.repo.CreateVersion(ctx, version); err != nil {
		return nil, err
	}
	
	doc.CurrentVersion = newVersionNumber
	if err := s.repo.UpdateDocument(ctx, doc); err != nil {
		return nil, err
	}
	
	return version, nil
}

func (s *documentService) ListVersions(ctx context.Context, id uuid.UUID) ([]DocumentVersion, error) {
	return s.repo.ListVersions(ctx, id)
}

func (s *documentService) GeneratePDF(ctx context.Context, req GeneratePDFRequest) (*Document, error) {
	pdfReader, err := s.pdf.GenerateReport(ctx, req.TemplateID, req.Data)
	if err != nil {
		return nil, err
	}
	
	doc, err := s.UploadDocument(ctx, UploadRequest{
		ProjectID:    req.ProjectID,
		Name:         req.Name,
		DocumentType: req.DocumentType,
		FileType:     FileTypePDF,
		FileContent:  pdfReader,
		UploadedBy:   req.UploadedBy,
	})

	if err != nil {
		return nil, err
	}

	// Trigger OCR as a background task
	go func() {
		_, _ = s.ExtractText(context.Background(), doc.ID)
	}()

	return doc, nil
}

func (s *documentService) GetDocumentVersion(ctx context.Context, id uuid.UUID, version int) (*DocumentVersion, error) {
	return s.repo.GetVersion(ctx, id, version)
}

func (s *documentService) ExtractText(ctx context.Context, id uuid.UUID) (string, error) {
	// Placeholder for OCR logic
	return "Extracted text content for indexing", nil
}

func (s *documentService) VerifySignature(ctx context.Context, id uuid.UUID) ([]security.SignatureInfo, error) {
	reader, err := s.DownloadDocument(ctx, id)
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	
	return s.sig.VerifyPDDSignature(ctx, reader)
}

func (s *documentService) TransitionWorkflow(ctx context.Context, id uuid.UUID, action string, userID uuid.UUID) error {
	return s.workflow.Transition(ctx, id.String(), action, userID.String())
}

func (s *documentService) TransitionStorageTier(ctx context.Context, id uuid.UUID, tier StorageTier) error {
	doc, err := s.repo.GetDocumentByID(ctx, id)
	if err != nil {
		return err
	}
	if doc == nil {
		return fmt.Errorf("document not found")
	}
	doc.StorageTier = tier
	return s.repo.UpdateDocument(ctx, doc)
}
