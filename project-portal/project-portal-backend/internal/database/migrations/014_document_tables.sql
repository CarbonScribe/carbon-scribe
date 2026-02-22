-- Migration: 014_document_tables
-- Description: Create tables for Document Management Service
-- Date: 2026-02-20

-- Document workflows table (must be created before documents so FK works)
CREATE TABLE IF NOT EXISTS document_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    document_type VARCHAR(100) NOT NULL,
    steps JSONB NOT NULL DEFAULT '[]', -- Array of {role, action, order}
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    document_type VARCHAR(100) NOT NULL, -- 'PDD', 'MONITORING_REPORT', 'VERIFICATION_CERTIFICATE', 'COMPLIANCE'
    file_type VARCHAR(50) NOT NULL,      -- 'PDF', 'DOCX', 'XLSX', 'IMAGE', 'ZIP'
    file_size BIGINT NOT NULL,
    s3_key VARCHAR(1000) NOT NULL,
    s3_bucket VARCHAR(255) NOT NULL,
    ipfs_cid VARCHAR(100),
    current_version INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'submitted', 'under_review', 'approved', 'rejected'
    workflow_id UUID REFERENCES document_workflows(id) ON DELETE SET NULL,
    uploaded_by UUID,
    uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,              -- soft delete
    metadata JSONB DEFAULT '{}'
);

-- Document versions table
CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    s3_key VARCHAR(1000) NOT NULL,
    s3_bucket VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    ipfs_cid VARCHAR(100),
    change_summary TEXT,
    uploaded_by UUID,
    uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, version_number)
);

-- Document signatures table
CREATE TABLE IF NOT EXISTS document_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    signer_name VARCHAR(255) NOT NULL,
    signer_email VARCHAR(255),
    signer_role VARCHAR(100),
    certificate_issuer VARCHAR(255),
    certificate_subject VARCHAR(255),
    signing_time TIMESTAMPTZ NOT NULL,
    is_valid BOOLEAN NOT NULL DEFAULT FALSE,
    verification_details JSONB DEFAULT '{}',
    verified_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Document access logs table
CREATE TABLE IF NOT EXISTS document_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID,
    action VARCHAR(50) NOT NULL, -- 'VIEW', 'DOWNLOAD', 'UPLOAD', 'APPROVE', 'REJECT', 'DELETE', 'VERSION_UPLOAD'
    ip_address INET,
    user_agent TEXT,
    details JSONB DEFAULT '{}',
    performed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON documents(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_document_id ON document_signatures(document_id);
CREATE INDEX IF NOT EXISTS idx_document_access_logs_document_id ON document_access_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_document_access_logs_user_id ON document_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_document_access_logs_performed_at ON document_access_logs(performed_at);

-- updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_document_workflows_updated_at
    BEFORE UPDATE ON document_workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
