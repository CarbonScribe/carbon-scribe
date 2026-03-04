package documents

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository handles all database operations for documents.
type Repository struct {
	db *gorm.DB
}

// NewRepository creates a new document Repository.
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new document record.
func (r *Repository) Create(ctx context.Context, doc *Document) error {
	if err := r.db.WithContext(ctx).Create(doc).Error; err != nil {
		return fmt.Errorf("failed to create document: %w", err)
	}
	return nil
}

// FindByID retrieves a document by UUID (excludes soft-deleted).
func (r *Repository) FindByID(ctx context.Context, id uuid.UUID) (*Document, error) {
	var doc Document
	err := r.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", id).
		First(&doc).Error
	if err != nil {
		return nil, fmt.Errorf("document not found: %w", err)
	}
	return &doc, nil
}

// FindAll retrieves documents matching the given filter (paginated).
func (r *Repository) FindAll(ctx context.Context, filter ListFilter) (*ListResponse, error) {
	query := r.db.WithContext(ctx).Model(&Document{}).Where("deleted_at IS NULL")

	if filter.ProjectID != "" {
		query = query.Where("project_id = ?", filter.ProjectID)
	}
	if filter.DocumentType != "" {
		query = query.Where("document_type = ?", filter.DocumentType)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.UploadedBy != "" {
		query = query.Where("uploaded_by = ?", filter.UploadedBy)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("failed to count documents: %w", err)
	}

	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	var docs []Document
	err := query.
		Order("uploaded_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&docs).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list documents: %w", err)
	}

	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))
	return &ListResponse{
		Data:       docs,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	}, nil
}

// Update saves changes to an existing document.
func (r *Repository) Update(ctx context.Context, doc *Document) error {
	if err := r.db.WithContext(ctx).Save(doc).Error; err != nil {
		return fmt.Errorf("failed to update document: %w", err)
	}
	return nil
}

// SoftDelete marks a document as deleted without removing the row.
func (r *Repository) SoftDelete(ctx context.Context, id uuid.UUID) error {
	result := r.db.WithContext(ctx).
		Model(&Document{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Update("deleted_at", gorm.Expr("CURRENT_TIMESTAMP"))
	if result.Error != nil {
		return fmt.Errorf("failed to delete document: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("document not found or already deleted")
	}
	return nil
}

// LogAccess inserts a document access log entry.
func (r *Repository) LogAccess(ctx context.Context, log *DocumentAccessLog) error {
	if err := r.db.WithContext(ctx).Create(log).Error; err != nil {
		// Non-fatal: log to stderr but don't propagate.
		fmt.Printf("WARNING: failed to write access log for document %s: %v\n", log.DocumentID, err)
	}
	return nil
}

// CreateVersion inserts a new version record.
func (r *Repository) CreateVersion(ctx context.Context, v *DocumentVersion) error {
	if err := r.db.WithContext(ctx).Create(v).Error; err != nil {
		return fmt.Errorf("failed to create document version: %w", err)
	}
	return nil
}

// FindVersionsByDocumentID retrieves all versions for a document ordered ASC.
func (r *Repository) FindVersionsByDocumentID(ctx context.Context, docID uuid.UUID) ([]DocumentVersion, error) {
	var versions []DocumentVersion
	err := r.db.WithContext(ctx).
		Where("document_id = ?", docID).
		Order("version_number ASC").
		Find(&versions).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list document versions: %w", err)
	}
	return versions, nil
}

// FindVersionByNumber retrieves a specific version of a document.
func (r *Repository) FindVersionByNumber(ctx context.Context, docID uuid.UUID, version int) (*DocumentVersion, error) {
	var v DocumentVersion
	err := r.db.WithContext(ctx).
		Where("document_id = ? AND version_number = ?", docID, version).
		First(&v).Error
	if err != nil {
		return nil, fmt.Errorf("version %d not found for document %s: %w", version, docID, err)
	}
	return &v, nil
}

// CreateSignature persists a digital signature verification result.
func (r *Repository) CreateSignature(ctx context.Context, sig *DocumentSignature) error {
	if err := r.db.WithContext(ctx).Create(sig).Error; err != nil {
		return fmt.Errorf("failed to persist document signature: %w", err)
	}
	return nil
}

// FindSignaturesByDocumentID retrieves all stored signature verifications for a document.
func (r *Repository) FindSignaturesByDocumentID(ctx context.Context, docID uuid.UUID) ([]DocumentSignature, error) {
	var sigs []DocumentSignature
	err := r.db.WithContext(ctx).
		Where("document_id = ?", docID).
		Order("verified_at DESC").
		Find(&sigs).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list document signatures: %w", err)
	}
	return sigs, nil
}

// ─── Workflow Template Methods ─────────────────────────────────────────────────

// CreateWorkflow inserts a new workflow template.
func (r *Repository) CreateWorkflow(ctx context.Context, wf *DocumentWorkflow) error {
	if err := r.db.WithContext(ctx).Create(wf).Error; err != nil {
		return fmt.Errorf("failed to create workflow template: %w", err)
	}
	return nil
}

// FindWorkflowByID retrieves a workflow template by ID.
func (r *Repository) FindWorkflowByID(ctx context.Context, id uuid.UUID) (*DocumentWorkflow, error) {
	var wf DocumentWorkflow
	if err := r.db.WithContext(ctx).First(&wf, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("workflow not found: %w", err)
	}
	return &wf, nil
}

// FindAllWorkflows returns all workflow templates.
func (r *Repository) FindAllWorkflows(ctx context.Context) ([]DocumentWorkflow, error) {
	var wfs []DocumentWorkflow
	if err := r.db.WithContext(ctx).Order("name ASC").Find(&wfs).Error; err != nil {
		return nil, fmt.Errorf("failed to list workflow templates: %w", err)
	}
	return wfs, nil
}

// AppendWorkflowStep appends a step entry to the steps JSONB array of a workflow.
// Non-fatal: logs warning on failure rather than returning an error.
func (r *Repository) AppendWorkflowStep(ctx context.Context, workflowID uuid.UUID, step interface{}) error {
	stepJSON, err := marshalStep(step)
	if err != nil {
		fmt.Printf("WARNING: failed to marshal workflow step: %v\n", err)
		return nil
	}
	result := r.db.WithContext(ctx).Exec(
		`UPDATE document_workflows SET steps = steps || ?::jsonb WHERE id = ?`,
		fmt.Sprintf("[%s]", stepJSON), workflowID,
	)
	if result.Error != nil {
		fmt.Printf("WARNING: failed to append workflow step: %v\n", result.Error)
	}
	return nil
}

// marshalStep JSON-encodes a workflow step for DB insertion.
func marshalStep(v interface{}) (string, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
