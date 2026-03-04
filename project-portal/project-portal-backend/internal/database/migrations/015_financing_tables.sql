-- Financing & Tokenization Service Tables
-- Migration for carbon credit financialization lifecycle management

-- Carbon credit calculations
CREATE TABLE IF NOT EXISTS carbon_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    vintage_year INTEGER NOT NULL,
    calculation_period_start DATE NOT NULL,
    calculation_period_end DATE NOT NULL,
    
    -- Credit details
    methodology_code VARCHAR(50) NOT NULL, -- 'VM0007', 'VM0015', etc.
    calculated_tons DECIMAL(12, 4) NOT NULL,
    buffered_tons DECIMAL(12, 4) NOT NULL, -- After uncertainty buffer
    issued_tons DECIMAL(12, 4), -- Actually minted tokens
    data_quality_score DECIMAL(3, 2),
    
    -- Calculation metadata
    calculation_inputs JSONB NOT NULL DEFAULT '{}', -- Input data used for calculation
    calculation_steps JSONB NOT NULL DEFAULT '[]', -- Step-by-step calculation log
    uncertainty_factors JSONB DEFAULT '{}', -- Factors affecting uncertainty
    baseline_scenario JSONB DEFAULT '{}', -- Baseline data for comparison
    
    -- Stellar integration
    stellar_asset_code VARCHAR(12), -- e.g., 'CARBON001'
    stellar_asset_issuer VARCHAR(56), -- G... address
    token_ids JSONB DEFAULT '[]', -- Array of minted token IDs from smart contract
    mint_transaction_hash VARCHAR(64),
    minted_at TIMESTAMPTZ,
    
    -- Status and verification
    status VARCHAR(50) DEFAULT 'calculated', -- 'calculated', 'verified', 'minting', 'minted', 'retired', 'cancelled'
    verification_id UUID,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    
    -- Audit trail
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Forward sale agreements
CREATE TABLE IF NOT EXISTS forward_sale_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id),
    seller_id UUID NOT NULL REFERENCES users(id),
    vintage_year INTEGER NOT NULL,
    
    -- Terms
    tons_committed DECIMAL(12, 4) NOT NULL,
    tons_delivered DECIMAL(12, 4) DEFAULT 0, -- Actual delivered amount
    price_per_ton DECIMAL(10, 4) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    total_amount DECIMAL(14, 4) NOT NULL,
    delivery_date DATE NOT NULL,
    
    -- Payment terms
    deposit_percent DECIMAL(5, 2) NOT NULL DEFAULT 10.0,
    deposit_amount DECIMAL(14, 4) GENERATED ALWAYS AS (total_amount * deposit_percent / 100) STORED,
    deposit_paid BOOLEAN DEFAULT FALSE,
    deposit_transaction_id VARCHAR(100),
    payment_schedule JSONB DEFAULT '[]', -- Milestone payments
    payment_terms JSONB DEFAULT '{}', -- Additional payment conditions
    
    -- Legal and compliance
    contract_template_id VARCHAR(100),
    contract_hash VARCHAR(64), -- Hash of signed contract
    contract_version INTEGER DEFAULT 1,
    signed_by_seller_at TIMESTAMPTZ,
    signed_by_buyer_at TIMESTAMPTZ,
    digital_signatures JSONB DEFAULT '{}', -- Signature metadata
    
    -- Risk and guarantees
    performance_bond_required BOOLEAN DEFAULT FALSE,
    performance_bond_amount DECIMAL(14, 4),
    insurance_required BOOLEAN DEFAULT FALSE,
    force_majeure_clause BOOLEAN DEFAULT TRUE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'active', 'partially_delivered', 'completed', 'cancelled', 'disputed'
    cancellation_reason TEXT,
    dispute_details JSONB DEFAULT '{}',
    
    -- Audit
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Revenue distribution
CREATE TABLE IF NOT EXISTS revenue_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_sale_id UUID NOT NULL, -- References credit sales or forward sales
    distribution_type VARCHAR(50) NOT NULL, -- 'credit_sale', 'forward_sale', 'royalty', 'retirement'
    
    -- Amounts
    total_received DECIMAL(14, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    exchange_rate DECIMAL(10, 6), -- If currency conversion needed
    platform_fee_percent DECIMAL(5, 2) NOT NULL,
    platform_fee_amount DECIMAL(12, 4) NOT NULL,
    net_amount DECIMAL(14, 4) NOT NULL,
    
    -- Distribution splits
    beneficiaries JSONB NOT NULL DEFAULT '[]', -- Array of {user_id, role, percent, amount, tax_withheld, status}
    distribution_rules JSONB DEFAULT '{}', -- Rules for splitting revenue
    
    -- Payment execution
    payment_batch_id VARCHAR(100), -- Reference to bulk payment execution
    payment_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'partial'
    payment_processed_at TIMESTAMPTZ,
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Compliance
    tax_withheld_total DECIMAL(12, 4) DEFAULT 0,
    tax_jurisdictions JSONB DEFAULT '[]', -- Tax jurisdictions involved
    compliance_documents JSONB DEFAULT '[]', -- Tax documents, receipts
    
    -- Audit
    created_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Payment transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(100) UNIQUE, -- ID from payment processor
    user_id UUID REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    distribution_id UUID REFERENCES revenue_distributions(id),
    
    -- Payment details
    amount DECIMAL(14, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    payment_method VARCHAR(50) NOT NULL, -- 'credit_card', 'bank_transfer', 'stellar', 'mpesa', 'paypal'
    payment_provider VARCHAR(50) NOT NULL, -- 'stripe', 'paypal', 'stellar_network', 'mpesa'
    gateway_transaction_id VARCHAR(100), -- Processor's transaction ID
    
    -- Status
    status VARCHAR(50) DEFAULT 'initiated', -- 'initiated', 'processing', 'completed', 'failed', 'refunded', 'disputed'
    provider_status JSONB DEFAULT '{}', -- Raw status from payment provider
    failure_reason TEXT,
    failure_code VARCHAR(50),
    
    -- Processing metadata
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    retry_attempts INTEGER DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    
    -- Blockchain specifics (for Stellar payments)
    stellar_transaction_hash VARCHAR(64),
    stellar_asset_code VARCHAR(12),
    stellar_asset_issuer VARCHAR(56),
    stellar_memo TEXT,
    
    -- Fees and settlements
    processing_fee DECIMAL(12, 4) DEFAULT 0,
    network_fee DECIMAL(12, 4) DEFAULT 0,
    settlement_amount DECIMAL(14, 4),
    settlement_currency VARCHAR(3),
    settled_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    webhook_events JSONB DEFAULT '[]', -- Webhook event log
    
    -- Audit
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Credit pricing models
CREATE TABLE IF NOT EXISTS credit_pricing_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    methodology_code VARCHAR(50) NOT NULL,
    region_code VARCHAR(10),
    vintage_year INTEGER,
    
    -- Pricing factors
    base_price DECIMAL(10, 4) NOT NULL, -- Base price per ton
    quality_multiplier JSONB DEFAULT '{}', -- Factors for data quality, co-benefits
    market_multiplier DECIMAL(6, 4) DEFAULT 1.0, -- Market demand multiplier
    location_adjustment JSONB DEFAULT '{}', -- Geographic pricing adjustments
    vintage_adjustment JSONB DEFAULT '{}', -- Age-based adjustments
    
    -- Pricing rules
    minimum_price DECIMAL(10, 4), -- Floor price
    maximum_price DECIMAL(10, 4), -- Ceiling price
    price_volatility_factor DECIMAL(5, 4) DEFAULT 0.1, -- Volatility multiplier
    
    -- Validity
    valid_from DATE NOT NULL,
    valid_until DATE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit
    created_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Pricing history and market data
CREATE TABLE IF NOT EXISTS credit_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pricing_model_id UUID NOT NULL REFERENCES credit_pricing_models(id),
    
    -- Price data
 methodology_code VARCHAR(50) NOT NULL,
    region_code VARCHAR(10),
    vintage_year INTEGER,
    price_per_ton DECIMAL(10, 4) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Market context
    market_source VARCHAR(100), -- Source of price data
    market_volume DECIMAL(14, 4), -- Trading volume
    market_sentiment VARCHAR(50), -- 'bullish', 'bearish', 'neutral'
    
    -- Effective period
    effective_date DATE NOT NULL,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Token minting workflows
CREATE TABLE IF NOT EXISTS token_minting_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_id UUID NOT NULL REFERENCES carbon_credits(id) ON DELETE CASCADE,
    
    -- Workflow configuration
    workflow_type VARCHAR(50) NOT NULL DEFAULT 'standard', -- 'standard', 'batch', 'emergency'
    priority INTEGER DEFAULT 5, -- 1-10 priority level
    
    -- Stellar contract details
    contract_address VARCHAR(56) NOT NULL, -- Soroban contract address
    function_name VARCHAR(100) NOT NULL DEFAULT 'mint',
    function_args JSONB NOT NULL DEFAULT '{}',
    
    -- Execution tracking
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'building', 'submitted', 'confirmed', 'failed', 'cancelled'
    stellar_transaction_hash VARCHAR(64),
    stellar_ledger_sequence BIGINT,
    
    -- Timing
    initiated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Error handling
    error_code VARCHAR(50),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    
    -- Gas and fees
    gas_used BIGINT,
    gas_price DECIMAL(10, 8),
    transaction_fee DECIMAL(14, 8),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Audit
    initiated_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Auction mechanisms for bulk sales
CREATE TABLE IF NOT EXISTS credit_auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    auction_type VARCHAR(50) NOT NULL, -- 'dutch', 'sealed_bid', 'english'
    
    -- Auction parameters
    total_tons DECIMAL(12, 4) NOT NULL,
    minimum_price DECIMAL(10, 4) NOT NULL,
    reserve_price DECIMAL(10, 4),
    start_price DECIMAL(10, 4), -- For Dutch auctions
    
    -- Timing
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    price_decrement_interval INTERVAL, -- For Dutch auctions
    price_decrement_amount DECIMAL(10, 4), -- For Dutch auctions
    
    -- Status
    status VARCHAR(50) DEFAULT 'upcoming', -- 'upcoming', 'active', 'ended', 'cancelled'
    winning_bid_id UUID,
    
    -- Results
    final_price DECIMAL(10, 4),
    total_sold DECIMAL(12, 4),
    total_revenue DECIMAL(14, 4),
    
    -- Audit
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Auction bids
CREATE TABLE IF NOT EXISTS auction_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL REFERENCES credit_auctions(id) ON DELETE CASCADE,
    bidder_id UUID NOT NULL REFERENCES users(id),
    
    -- Bid details
    bid_amount DECIMAL(12, 4) NOT NULL, -- Tons requested
    bid_price DECIMAL(10, 4) NOT NULL, -- Price per ton
    total_value DECIMAL(14, 4) GENERATED ALWAYS AS (bid_amount * bid_price) STORED,
    
    -- Bid status
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'winning', 'losing', 'withdrawn'
    is_winning BOOLEAN DEFAULT FALSE,
    
    -- Timing
    placed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT unique_auction_bidder UNIQUE(auction_id, bidder_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_carbon_credits_project_id ON carbon_credits(project_id);
CREATE INDEX IF NOT EXISTS idx_carbon_credits_vintage_year ON carbon_credits(vintage_year);
CREATE INDEX IF NOT EXISTS idx_carbon_credits_status ON carbon_credits(status);
CREATE INDEX IF NOT EXISTS idx_carbon_credits_methodology ON carbon_credits(methodology_code);
CREATE INDEX IF NOT EXISTS idx_carbon_credits_stellar_asset ON carbon_credits(stellar_asset_code, stellar_asset_issuer);

CREATE INDEX IF NOT EXISTS idx_forward_sales_project_id ON forward_sale_agreements(project_id);
CREATE INDEX IF NOT EXISTS idx_forward_sales_buyer_id ON forward_sale_agreements(buyer_id);
CREATE INDEX IF NOT EXISTS idx_forward_sales_status ON forward_sale_agreements(status);
CREATE INDEX IF NOT EXISTS idx_forward_sales_delivery_date ON forward_sale_agreements(delivery_date);
CREATE INDEX IF NOT EXISTS idx_forward_sales_vintage_year ON forward_sale_agreements(vintage_year);

CREATE INDEX IF NOT EXISTS idx_revenue_distributions_sale_id ON revenue_distributions(credit_sale_id);
CREATE INDEX IF NOT EXISTS idx_revenue_distributions_status ON revenue_distributions(payment_status);
CREATE INDEX IF NOT EXISTS idx_revenue_distributions_type ON revenue_distributions(distribution_type);
CREATE INDEX IF NOT EXISTS idx_revenue_distributions_created_at ON revenue_distributions(created_at);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_project_id ON payment_transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider ON payment_transactions(payment_provider);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_external_id ON payment_transactions(external_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_stellar_hash ON payment_transactions(stellar_transaction_hash);

CREATE INDEX IF NOT EXISTS idx_pricing_models_methodology ON credit_pricing_models(methodology_code);
CREATE INDEX IF NOT EXISTS idx_pricing_models_region ON credit_pricing_models(region_code);
CREATE INDEX IF NOT EXISTS idx_pricing_models_vintage ON credit_pricing_models(vintage_year);
CREATE INDEX IF NOT EXISTS idx_pricing_models_active ON credit_pricing_models(is_active);

CREATE INDEX IF NOT EXISTS idx_price_history_methodology ON credit_price_history(methodology_code);
CREATE INDEX IF NOT EXISTS idx_price_history_effective_date ON credit_price_history(effective_date);

CREATE INDEX IF NOT EXISTS idx_minting_workflows_credit_id ON token_minting_workflows(credit_id);
CREATE INDEX IF NOT EXISTS idx_minting_workflows_status ON token_minting_workflows(status);
CREATE INDEX IF NOT EXISTS idx_minting_workflows_hash ON token_minting_workflows(stellar_transaction_hash);

CREATE INDEX IF NOT EXISTS idx_auctions_project_id ON credit_auctions(project_id);
CREATE INDEX IF NOT EXISTS idx_auctions_status ON credit_auctions(status);
CREATE INDEX IF NOT EXISTS idx_auctions_start_time ON credit_auctions(start_time);

CREATE INDEX IF NOT EXISTS idx_auction_bids_auction_id ON auction_bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_bidder_id ON auction_bids(bidder_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_status ON auction_bids(status);

-- Row Level Security (RLS) policies
ALTER TABLE carbon_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE forward_sale_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_bids ENABLE ROW LEVEL SECURITY;

-- Comments for documentation
COMMENT ON TABLE carbon_credits IS 'Core table for tracking calculated and minted carbon credits';
COMMENT ON TABLE forward_sale_agreements IS 'Forward sale contracts for future carbon credit delivery';
COMMENT ON TABLE revenue_distributions IS 'Revenue sharing and distribution records';
COMMENT ON TABLE payment_transactions IS 'All payment processing records across providers';
COMMENT ON TABLE credit_pricing_models IS 'Configurable pricing models for carbon credits';
COMMENT ON TABLE credit_price_history IS 'Historical pricing data and market information';
COMMENT ON TABLE token_minting_workflows IS 'Stellar blockchain token minting workflow tracking';
COMMENT ON TABLE credit_auctions IS 'Auction mechanisms for bulk carbon credit sales';
COMMENT ON TABLE auction_bids IS 'Individual bids in carbon credit auctions';
