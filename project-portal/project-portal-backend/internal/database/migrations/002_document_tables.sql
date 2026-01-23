-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL, -- Simplified as I don't see projects table yet in migrations, but user said REFERENCES projects(id)
    name VARCHAR(500) NOT NULL,
    description TEXT,
    document_type VARCHAR(100) NOT NULL, -- 'PDD', 'MONITORING_REPORT', 'VERIFICATION_CERTIFICATE'
    file_type VARCHAR(50) NOT NULL, -- 'PDF', 'DOCX', 'XLSX', 'IMAGE', 'ZIP'
    file_size BIGINT NOT NULL,
    s3_key VARCHAR(1000) NOT NULL, -- S3 object key
    s3_bucket VARCHAR(255) NOT NULL,
    ipfs_cid VARCHAR(100), -- IPFS Content Identifier
    current_version INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'submitted', 'under_review', 'approved', 'rejected'
    storage_tier VARCHAR(20) DEFAULT 'hot',
    workflow_id UUID,
    current_step INTEGER DEFAULT 0,
    due_at TIMESTAMP,
    uploaded_by UUID,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- Document versions table
CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    s3_key VARCHAR(1000) NOT NULL,
    ipfs_cid VARCHAR(100),
    change_summary TEXT,
    uploaded_by UUID,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, version_number)
);

-- Document workflows table
CREATE TABLE IF NOT EXISTS document_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    document_type VARCHAR(100) NOT NULL,
    steps JSONB NOT NULL, -- Array of {role, action, order}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key to documents table for workflow_id
ALTER TABLE documents ADD CONSTRAINT fk_document_workflow FOREIGN KEY (workflow_id) REFERENCES document_workflows(id);

-- Document signatures table
CREATE TABLE IF NOT EXISTS document_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    signer_name VARCHAR(255) NOT NULL,
    signer_role VARCHAR(100),
    certificate_issuer VARCHAR(255),
    signing_time TIMESTAMP NOT NULL,
    is_valid BOOLEAN NOT NULL,
    verification_details JSONB,
    verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document access logs
CREATE TABLE IF NOT EXISTS document_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID,
    action VARCHAR(50) NOT NULL, -- 'VIEW', 'DOWNLOAD', 'UPLOAD', 'APPROVE', 'REJECT'
    ip_address INET,
    user_agent TEXT,
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
