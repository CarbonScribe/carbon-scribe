package documents

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository interface {
	CreateDocument(ctx context.Context, doc *Document) error
	GetDocumentByID(ctx context.Context, id uuid.UUID) (*Document, error)
	ListDocuments(ctx context.Context, projectID *uuid.UUID, docType *DocumentType) ([]Document, error)
	UpdateDocument(ctx context.Context, doc *Document) error
	DeleteDocument(ctx context.Context, id uuid.UUID) error

	CreateVersion(ctx context.Context, version *DocumentVersion) error
	ListVersions(ctx context.Context, documentID uuid.UUID) ([]DocumentVersion, error)
	GetVersion(ctx context.Context, documentID uuid.UUID, versionNumber int) (*DocumentVersion, error)

	CreateWorkflow(ctx context.Context, workflow *DocumentWorkflow) error
	GetWorkflowByID(ctx context.Context, id uuid.UUID) (*DocumentWorkflow, error)

	CreateSignature(ctx context.Context, signature *DocumentSignature) error
	ListSignatures(ctx context.Context, documentID uuid.UUID) ([]DocumentSignature, error)

	LogAccess(ctx context.Context, log *DocumentAccessLog) error
}

type postgresRepository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) Repository {
	return &postgresRepository{db: db}
}

func (r *postgresRepository) CreateDocument(ctx context.Context, doc *Document) error {
	query := `
		INSERT INTO documents (
			id, project_id, name, description, document_type, file_type, 
			file_size, s3_key, s3_bucket, ipfs_cid, storage_tier, current_version, 
			status, workflow_id, current_step, due_at, uploaded_by, metadata
		) VALUES (
			:id, :project_id, :name, :description, :document_type, :file_type, 
			:file_size, :s3_key, :s3_bucket, :ipfs_cid, :storage_tier, :current_version, 
			:status, :workflow_id, :current_step, :due_at, :uploaded_by, :metadata
		)`
	_, err := r.db.NamedExecContext(ctx, query, doc)
	return err
}

func (r *postgresRepository) GetDocumentByID(ctx context.Context, id uuid.UUID) (*Document, error) {
	var doc Document
	err := r.db.GetContext(ctx, &doc, "SELECT * FROM documents WHERE id = $1", id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &doc, err
}

func (r *postgresRepository) ListDocuments(ctx context.Context, projectID *uuid.UUID, docType *DocumentType) ([]Document, error) {
	var docs []Document
	query := "SELECT * FROM documents WHERE 1=1"
	var args []interface{}
	argCount := 1

	if projectID != nil {
		query += fmt.Sprintf(" AND project_id = $%d", argCount)
		args = append(args, *projectID)
		argCount++
	}
	if docType != nil {
		query += fmt.Sprintf(" AND document_type = $%d", argCount)
		args = append(args, *docType)
		argCount++
	}

	err := r.db.SelectContext(ctx, &docs, query, args...)
	return docs, err
}

func (r *postgresRepository) UpdateDocument(ctx context.Context, doc *Document) error {
	query := `
		UPDATE documents SET
			name = :name,
			description = :description,
			status = :status,
			current_version = :current_version,
			storage_tier = :storage_tier,
			workflow_id = :workflow_id,
			current_step = :current_step,
			due_at = :due_at,
			metadata = :metadata
		WHERE id = :id`
	_, err := r.db.NamedExecContext(ctx, query, doc)
	return err
}

func (r *postgresRepository) DeleteDocument(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM documents WHERE id = $1", id)
	return err
}

func (r *postgresRepository) CreateVersion(ctx context.Context, version *DocumentVersion) error {
	query := `
		INSERT INTO document_versions (
			id, document_id, version_number, s3_key, ipfs_cid, change_summary, uploaded_by
		) VALUES (
			:id, :document_id, :version_number, :s3_key, :ipfs_cid, :change_summary, :uploaded_by
		)`
	_, err := r.db.NamedExecContext(ctx, query, version)
	return err
}

func (r *postgresRepository) ListVersions(ctx context.Context, documentID uuid.UUID) ([]DocumentVersion, error) {
	var versions []DocumentVersion
	err := r.db.SelectContext(ctx, &versions, "SELECT * FROM document_versions WHERE document_id = $1 ORDER BY version_number DESC", documentID)
	return versions, err
}

func (r *postgresRepository) GetVersion(ctx context.Context, documentID uuid.UUID, versionNumber int) (*DocumentVersion, error) {
	var version DocumentVersion
	err := r.db.GetContext(ctx, &version, "SELECT * FROM document_versions WHERE document_id = $1 AND version_number = $2", documentID, versionNumber)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &version, err
}

func (r *postgresRepository) CreateWorkflow(ctx context.Context, workflow *DocumentWorkflow) error {
	query := `
		INSERT INTO document_workflows (
			id, name, description, document_type, steps
		) VALUES (
			:id, :name, :description, :document_type, :steps
		)`
	_, err := r.db.NamedExecContext(ctx, query, workflow)
	return err
}

func (r *postgresRepository) GetWorkflowByID(ctx context.Context, id uuid.UUID) (*DocumentWorkflow, error) {
	var workflow DocumentWorkflow
	err := r.db.GetContext(ctx, &workflow, "SELECT * FROM document_workflows WHERE id = $1", id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &workflow, err
}

func (r *postgresRepository) CreateSignature(ctx context.Context, signature *DocumentSignature) error {
	query := `
		INSERT INTO document_signatures (
			id, document_id, signer_name, signer_role, certificate_issuer, 
			signing_time, is_valid, verification_details
		) VALUES (
			:id, :document_id, :signer_name, :signer_role, :certificate_issuer, 
			:signing_time, :is_valid, :verification_details
		)`
	_, err := r.db.NamedExecContext(ctx, query, signature)
	return err
}

func (r *postgresRepository) ListSignatures(ctx context.Context, documentID uuid.UUID) ([]DocumentSignature, error) {
	var signatures []DocumentSignature
	err := r.db.SelectContext(ctx, &signatures, "SELECT * FROM document_signatures WHERE document_id = $1 ORDER BY signing_time DESC", documentID)
	return signatures, err
}

func (r *postgresRepository) LogAccess(ctx context.Context, log *DocumentAccessLog) error {
	query := `
		INSERT INTO document_access_logs (
			id, document_id, user_id, action, ip_address, user_agent
		) VALUES (
			:id, :document_id, :user_id, :action, :ip_address, :user_agent
		)`
	_, err := r.db.NamedExecContext(ctx, query, log)
	return err
}
