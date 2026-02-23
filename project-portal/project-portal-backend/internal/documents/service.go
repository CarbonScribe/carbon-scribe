package documents

import (
	"context"
	"fmt"
	"mime/multipart"
	"time"

	"github.com/google/uuid"
)

// multipartFile is the concrete type we accept from Gin handlers.
type multipartFile = *multipart.FileHeader

// Service contains the core business logic for document management.
type Service struct {
	repo    *Repository
	storage *StorageService
	ipfs    *IPFSUploader // optional; nil when IPFS_ENABLED=false
}

// NewService creates a new document Service.
func NewService(repo *Repository, storage *StorageService) *Service {
	return &Service{repo: repo, storage: storage}
}

// NewServiceWithIPFS creates a document Service with optional IPFS pinning.
func NewServiceWithIPFS(repo *Repository, storage *StorageService, ipfs *IPFSUploader) *Service {
	return &Service{repo: repo, storage: storage, ipfs: ipfs}
}

// UploadFile uploads a new document: validates, streams to S3, persists to DB.
// On DB failure, the S3 object is removed (best-effort).
func (s *Service) UploadFile(ctx context.Context, req *UploadRequest, fh *multipart.FileHeader, userID *uuid.UUID) (*Document, error) {
	docType := DocumentType(req.DocumentType)

	// Stream to S3.
	key, bucket, fileType, size, err := s.storage.UploadFile(ctx, req.ProjectID, docType, fh)
	if err != nil {
		return nil, fmt.Errorf("storage upload failed: %w", err)
	}

	pid, err := uuid.Parse(req.ProjectID)
	if err != nil {
		_ = s.storage.Delete(ctx, key) // clean up orphaned S3 object
		return nil, fmt.Errorf("invalid project_id: %w", err)
	}

	doc := &Document{
		ID:           uuid.New(),
		ProjectID:    pid,
		Name:         req.Name,
		Description:  req.Description,
		DocumentType: docType,
		FileType:     fileType,
		FileSize:     size,
		S3Key:        key,
		S3Bucket:     bucket,
		Status:       DocumentStatusDraft,
		UploadedBy:   userID,
		UploadedAt:   time.Now().UTC(),
	}

	if err := s.repo.Create(ctx, doc); err != nil {
		_ = s.storage.Delete(ctx, key)
		return nil, err
	}

	// Optionally pin to IPFS (best-effort: failure is logged, not fatal).
	s.pinToIPFS(ctx, doc, key)

	_ = s.repo.LogAccess(ctx, &DocumentAccessLog{
		DocumentID:  doc.ID,
		UserID:      userID,
		Action:      ActionUpload,
		PerformedAt: time.Now().UTC(),
	})
	return doc, nil
}

// List returns a paginated list of documents matching the filter.
func (s *Service) List(ctx context.Context, filter ListFilter) (*ListResponse, error) {
	return s.repo.FindAll(ctx, filter)
}

// GetMetadata returns document metadata (no S3 download).
func (s *Service) GetMetadata(ctx context.Context, id uuid.UUID, userID *uuid.UUID, ipAddr, ua string) (*Document, error) {
	doc, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	_ = s.repo.LogAccess(ctx, &DocumentAccessLog{
		DocumentID:  id,
		UserID:      userID,
		Action:      ActionView,
		IPAddress:   ipAddr,
		UserAgent:   ua,
		PerformedAt: time.Now().UTC(),
	})
	return doc, nil
}

// GenerateDownloadURL returns a presigned S3 URL (15-minute TTL) and logs DOWNLOAD.
func (s *Service) GenerateDownloadURL(ctx context.Context, id uuid.UUID, userID *uuid.UUID, ipAddr, ua string) (string, *Document, error) {
	doc, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return "", nil, err
	}
	url, err := s.storage.GeneratePresignedURL(ctx, doc.S3Key)
	if err != nil {
		return "", nil, fmt.Errorf("failed to generate download URL: %w", err)
	}
	_ = s.repo.LogAccess(ctx, &DocumentAccessLog{
		DocumentID:  id,
		UserID:      userID,
		Action:      ActionDownload,
		IPAddress:   ipAddr,
		UserAgent:   ua,
		PerformedAt: time.Now().UTC(),
	})
	return url, doc, nil
}

// VersionUploadRequest carries data for uploading a new version.
type VersionUploadRequest struct {
	ChangeSummary string `form:"change_summary"`
}

// UploadVersion uploads a new revision of an existing document.
// Auto-increments the version number and updates the parent document record.
func (s *Service) UploadVersion(ctx context.Context, docID uuid.UUID, req *VersionUploadRequest, fh *multipart.FileHeader, userID *uuid.UUID) (*DocumentVersion, error) {
	doc, err := s.repo.FindByID(ctx, docID)
	if err != nil {
		return nil, fmt.Errorf("document not found: %w", err)
	}

	key, bucket, _, size, err := s.storage.UploadFile(ctx, doc.ProjectID.String(), doc.DocumentType, fh)
	if err != nil {
		return nil, fmt.Errorf("storage upload failed: %w", err)
	}

	newVersion := doc.CurrentVersion + 1

	version := &DocumentVersion{
		ID:            uuid.New(),
		DocumentID:    docID,
		VersionNumber: newVersion,
		S3Key:         key,
		S3Bucket:      bucket,
		FileSize:      size,
		ChangeSummary: req.ChangeSummary,
		UploadedBy:    userID,
		UploadedAt:    time.Now().UTC(),
	}

	if err := s.repo.CreateVersion(ctx, version); err != nil {
		_ = s.storage.Delete(ctx, key)
		return nil, err
	}

	// Update parent document to track the latest version.
	doc.CurrentVersion = newVersion
	doc.S3Key = key
	doc.S3Bucket = bucket
	doc.FileSize = size
	if err := s.repo.Update(ctx, doc); err != nil {
		fmt.Printf("WARNING: failed to update document current_version to %d: %v\n", newVersion, err)
	}

	_ = s.repo.LogAccess(ctx, &DocumentAccessLog{
		DocumentID:  docID,
		UserID:      userID,
		Action:      ActionVersionUpload,
		PerformedAt: time.Now().UTC(),
	})
	return version, nil
}

// ListVersions returns all versions for a given document in ascending order.
func (s *Service) ListVersions(ctx context.Context, docID uuid.UUID) ([]DocumentVersion, error) {
	if _, err := s.repo.FindByID(ctx, docID); err != nil {
		return nil, fmt.Errorf("document not found: %w", err)
	}
	return s.repo.FindVersionsByDocumentID(ctx, docID)
}

// GetVersion retrieves a specific version of a document.
func (s *Service) GetVersion(ctx context.Context, docID uuid.UUID, version int) (*DocumentVersion, error) {
	if _, err := s.repo.FindByID(ctx, docID); err != nil {
		return nil, fmt.Errorf("document not found: %w", err)
	}
	return s.repo.FindVersionByNumber(ctx, docID, version)
}

// Delete soft-deletes the DB record and removes the object from S3.
func (s *Service) Delete(ctx context.Context, id uuid.UUID, userID *uuid.UUID, ipAddr, ua string) error {
	doc, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if err := s.repo.SoftDelete(ctx, id); err != nil {
		return err
	}
	if err := s.storage.Delete(ctx, doc.S3Key); err != nil {
		fmt.Printf("WARNING: S3 delete failed for key %q: %v\n", doc.S3Key, err)
	}
	_ = s.repo.LogAccess(ctx, &DocumentAccessLog{
		DocumentID:  id,
		UserID:      userID,
		Action:      ActionDelete,
		IPAddress:   ipAddr,
		UserAgent:   ua,
		PerformedAt: time.Now().UTC(),
	})
	return nil
}

// ─── IPFS helpers ─────────────────────────────────────────────────────────────

// pinToIPFS downloads the document from S3 and pins it to IPFS.
// It updates the document's IPFS_CID field in the DB on success.
// All errors are non-fatal — they are logged to stderr as warnings.
func (s *Service) pinToIPFS(ctx context.Context, doc *Document, s3Key string) {
	if s.ipfs == nil {
		return // IPFS disabled
	}

	// Download bytes from S3.
	data, err := s.storage.DownloadBytes(ctx, s3Key)
	if err != nil {
		fmt.Printf("WARNING: IPFS pin skipped — failed to download %q from S3: %v\n", s3Key, err)
		return
	}

	// Pin to IPFS.
	cid, err := s.ipfs.PinDocument(ctx, doc.ID.String(), data)
	if err != nil {
		fmt.Printf("WARNING: IPFS pin failed for document %s: %v\n", doc.ID, err)
		return
	}
	if cid == "" {
		return
	}

	// Persist the CID in the document record.
	doc.IPFSCID = cid
	if err := s.repo.Update(ctx, doc); err != nil {
		fmt.Printf("WARNING: failed to save IPFS CID for document %s: %v\n", doc.ID, err)
	}
}

