package documents

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"carbon-scribe/project-portal/project-portal-backend/pkg/storage"
	"carbon-scribe/project-portal/project-portal-backend/pkg/pdf"
	"carbon-scribe/project-portal/project-portal-backend/pkg/security"
)

// MockRepository is a mock implementation of the Repository interface
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) CreateDocument(ctx context.Context, doc *Document) error {
	args := m.Called(ctx, doc)
	return args.Error(0)
}

func (m *MockRepository) GetDocumentByID(ctx context.Context, id uuid.UUID) (*Document, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Document), args.Error(1)
}

func (m *MockRepository) ListDocuments(ctx context.Context, projectID *uuid.UUID, docType *DocumentType) ([]Document, error) {
	args := m.Called(ctx, projectID, docType)
	return args.Get(0).([]Document), args.Error(1)
}

func (m *MockRepository) UpdateDocument(ctx context.Context, doc *Document) error {
	args := m.Called(ctx, doc)
	return args.Error(0)
}

func (m *MockRepository) DeleteDocument(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockRepository) CreateVersion(ctx context.Context, version *DocumentVersion) error {
	args := m.Called(ctx, version)
	return args.Error(0)
}

func (m *MockRepository) ListVersions(ctx context.Context, documentID uuid.UUID) ([]DocumentVersion, error) {
	args := m.Called(ctx, documentID)
	return args.Get(0).([]DocumentVersion), args.Error(1)
}

func (m *MockRepository) GetVersion(ctx context.Context, documentID uuid.UUID, versionNumber int) (*DocumentVersion, error) {
	args := m.Called(ctx, documentID, versionNumber)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*DocumentVersion), args.Error(1)
}

func (m *MockRepository) CreateWorkflow(ctx context.Context, workflow *DocumentWorkflow) error {
	args := m.Called(ctx, workflow)
	return args.Error(0)
}

func (m *MockRepository) GetWorkflowByID(ctx context.Context, id uuid.UUID) (*DocumentWorkflow, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*DocumentWorkflow), args.Error(1)
}

func (m *MockRepository) CreateSignature(ctx context.Context, signature *DocumentSignature) error {
	args := m.Called(ctx, signature)
	return args.Error(0)
}

func (m *MockRepository) ListSignatures(ctx context.Context, documentID uuid.UUID) ([]DocumentSignature, error) {
	args := m.Called(ctx, documentID)
	return args.Get(0).([]DocumentSignature), args.Error(1)
}

func (m *MockRepository) LogAccess(ctx context.Context, log *DocumentAccessLog) error {
	args := m.Called(ctx, log)
	return args.Error(0)
}

func TestUploadDocument(t *testing.T) {
	mockRepo := new(MockRepository)
	// We need to provide actual storage/pdf/sig/workflow objects or mocks for them too
	// For simplicity, using the current implementation's providers which use mocks internally
	
	storageProvider := NewStorageProvider(storage.NewS3Client(), storage.NewIPFSClient())
	pdfService := NewPDFService(pdf.NewGenerator())
	sigService := NewSignatureService(security.NewValidator())
	workflowService := NewWorkflowService(mockRepo)
	
	service := NewService(mockRepo, storageProvider, pdfService, sigService, workflowService)
	
	ctx := context.Background()
	req := UploadRequest{
		ProjectID:    uuid.New(),
		Name:         "test.pdf",
		Description:  "Test Document",
		DocumentType: TypePDD,
		FileType:     FileTypePDF,
		FileSize:     1024,
		FileContent:  strings.NewReader("fake content"),
		UploadedBy:   uuid.New(),
	}
	
	mockRepo.On("CreateDocument", ctx, mock.AnythingOfType("*documents.Document")).Return(nil)
	
	doc, err := service.UploadDocument(ctx, req)
	
	assert.NoError(t, err)
	assert.NotNil(t, doc)
	assert.Equal(t, req.Name, doc.Name)
	assert.Equal(t, req.DocumentType, doc.DocumentType)
	assert.Equal(t, StatusDraft, doc.Status)
	
	mockRepo.AssertExpectations(t)
}

func TestUploadNewVersion(t *testing.T) {
	mockRepo := new(MockRepository)
	storageProvider := NewStorageProvider(storage.NewS3Client(), storage.NewIPFSClient())
	pdfService := NewPDFService(pdf.NewGenerator())
	sigService := NewSignatureService(security.NewValidator())
	workflowService := NewWorkflowService(mockRepo)
	
	service := NewService(mockRepo, storageProvider, pdfService, sigService, workflowService)
	
	ctx := context.Background()
	docID := uuid.New()
	existingDoc := &Document{
		ID:             docID,
		ProjectID:      uuid.New(),
		Name:           "test.pdf",
		CurrentVersion: 1,
		S3Bucket:       "carbonscribe-docs",
	}
	
	req := VersionRequest{
		FileContent:   strings.NewReader("new content"),
		ChangeSummary: "Updated content",
		UploadedBy:    uuid.New(),
	}
	
	mockRepo.On("GetDocumentByID", ctx, docID).Return(existingDoc, nil)
	mockRepo.On("CreateVersion", ctx, mock.AnythingOfType("*documents.DocumentVersion")).Return(nil)
	mockRepo.On("UpdateDocument", ctx, mock.AnythingOfType("*documents.Document")).Return(nil)
	
	version, err := service.UploadNewVersion(ctx, docID, req)
	
	assert.NoError(t, err)
	assert.NotNil(t, version)
	assert.Equal(t, 2, version.VersionNumber)
	assert.Equal(t, 2, existingDoc.CurrentVersion)
	
	mockRepo.AssertExpectations(t)
}

