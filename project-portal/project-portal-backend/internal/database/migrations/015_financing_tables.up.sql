-- Financing & Tokenization tables

CREATE TABLE IF NOT EXISTS carbon_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    vintage_year INTEGER NOT NULL,
    calculation_period_start DATE NOT NULL,
    calculation_period_end DATE NOT NULL,
    methodology_code VARCHAR(50) NOT NULL,
    calculated_tons DECIMAL(12, 4) NOT NULL,
    buffered_tons DECIMAL(12, 4) NOT NULL,
    issued_tons DECIMAL(12, 4),
    data_quality_score DECIMAL(3, 2),
    calculation_inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
    calculation_audit_trail JSONB NOT NULL DEFAULT '{}'::jsonb,
    stellar_asset_code VARCHAR(12),
    stellar_asset_issuer VARCHAR(56),
    token_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    mint_transaction_hash VARCHAR(128),
    minted_at TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'calculated',
    verification_id UUID,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_carbon_credits_project_id ON carbon_credits(project_id);
CREATE INDEX IF NOT EXISTS idx_carbon_credits_status ON carbon_credits(status);
CREATE INDEX IF NOT EXISTS idx_carbon_credits_methodology ON carbon_credits(methodology_code);

CREATE TABLE IF NOT EXISTS forward_sale_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    buyer_id UUID NOT NULL REFERENCES users(id),
    vintage_year INTEGER NOT NULL,
    tons_committed DECIMAL(12, 4) NOT NULL,
    price_per_ton DECIMAL(10, 4) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    total_amount DECIMAL(14, 4) NOT NULL,
    delivery_date DATE NOT NULL,
    deposit_percent DECIMAL(5, 2) NOT NULL,
    deposit_paid BOOLEAN DEFAULT FALSE,
    deposit_transaction_id VARCHAR(100),
    payment_schedule JSONB NOT NULL DEFAULT '{}'::jsonb,
    contract_hash VARCHAR(64),
    signed_by_seller_at TIMESTAMPTZ,
    signed_by_buyer_at TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_forward_sales_project_id ON forward_sale_agreements(project_id);
CREATE INDEX IF NOT EXISTS idx_forward_sales_buyer_id ON forward_sale_agreements(buyer_id);

CREATE TABLE IF NOT EXISTS revenue_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_sale_id UUID NOT NULL,
    distribution_type VARCHAR(50) NOT NULL,
    total_received DECIMAL(14, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    platform_fee_percent DECIMAL(5, 2) NOT NULL,
    platform_fee_amount DECIMAL(12, 4) NOT NULL,
    net_amount DECIMAL(14, 4) NOT NULL,
    beneficiaries JSONB NOT NULL,
    payment_batch_id VARCHAR(100),
    payment_status VARCHAR(50) DEFAULT 'pending',
    payment_processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_revenue_distributions_sale_id ON revenue_distributions(credit_sale_id);

CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(100) UNIQUE,
    user_id UUID REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    amount DECIMAL(14, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_provider VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'initiated',
    provider_status JSONB NOT NULL DEFAULT '{}'::jsonb,
    failure_reason TEXT,
    stellar_transaction_hash VARCHAR(128),
    stellar_asset_code VARCHAR(12),
    stellar_asset_issuer VARCHAR(56),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_project_id ON payment_transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);

CREATE TABLE IF NOT EXISTS credit_pricing_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    methodology_code VARCHAR(50) NOT NULL,
    region_code VARCHAR(10),
    vintage_year INTEGER,
    base_price DECIMAL(10, 4) NOT NULL,
    quality_multiplier JSONB NOT NULL DEFAULT '{}'::jsonb,
    market_multiplier DECIMAL(6, 4) DEFAULT 1.0,
    valid_from DATE NOT NULL,
    valid_until DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pricing_models_methodology ON credit_pricing_models(methodology_code);
CREATE INDEX IF NOT EXISTS idx_pricing_models_region ON credit_pricing_models(region_code);
CREATE INDEX IF NOT EXISTS idx_pricing_models_active ON credit_pricing_models(is_active);
