-- Create Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    wallet_address VARCHAR(56),
    full_name VARCHAR(255),
    organization VARCHAR(255),
    role VARCHAR(50) DEFAULT 'farmer',
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_role ON users(role);

-- Create User Sessions table for session tracking
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    access_token_id VARCHAR(100) UNIQUE NOT NULL,
    refresh_token_id VARCHAR(100) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_access_token_id ON user_sessions(access_token_id);
CREATE INDEX idx_sessions_refresh_token_id ON user_sessions(refresh_token_id);
CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);

-- Create RBAC Permissions table
CREATE TABLE role_permissions (
    role VARCHAR(50) PRIMARY KEY,
    permissions JSONB NOT NULL DEFAULT '[]',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Auth Tokens table for email verification and password reset
CREATE TABLE auth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    token_type VARCHAR(50) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_auth_tokens_token ON auth_tokens(token);
CREATE INDEX idx_auth_tokens_user_id ON auth_tokens(user_id);
CREATE INDEX idx_auth_tokens_type ON auth_tokens(token_type);

-- Create User Wallets table for multi-wallet support
CREATE TABLE user_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    wallet_address VARCHAR(56) UNIQUE NOT NULL,
    wallet_type VARCHAR(50) DEFAULT 'stellar',
    is_primary BOOLEAN DEFAULT FALSE,
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX idx_user_wallets_address ON user_wallets(wallet_address);

-- Initialize default role permissions
INSERT INTO role_permissions (role, permissions, description) VALUES
('farmer', '[
    "auth:read_profile",
    "auth:update_profile",
    "auth:change_password",
    "projects:create",
    "projects:read",
    "projects:update_own",
    "projects:delete_own",
    "documents:read",
    "documents:create",
    "documents:delete_own",
    "reports:read",
    "monitoring:read"
]'::jsonb, 'Farmer role with basic project and document management'),
('verifier', '[
    "auth:read_profile",
    "auth:update_profile",
    "auth:change_password",
    "projects:read",
    "projects:verify",
    "documents:read",
    "documents:verify",
    "reports:read",
    "monitoring:read"
]'::jsonb, 'Verifier role for compliance and verification tasks'),
('admin', '[
    "auth:read_profile",
    "auth:update_profile",
    "auth:change_password",
    "auth:manage_users",
    "auth:manage_roles",
    "projects:read",
    "projects:update",
    "projects:delete",
    "projects:approve",
    "documents:read",
    "documents:verify",
    "reports:read",
    "reports:generate",
    "monitoring:read",
    "monitoring:manage",
    "settings:manage",
    "compliance:manage"
]'::jsonb, 'Admin role with full management access'),
('viewer', '[
    "auth:read_profile",
    "projects:read",
    "documents:read",
    "reports:read",
    "monitoring:read"
]'::jsonb, 'Viewer role with read-only access');
