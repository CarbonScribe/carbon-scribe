-- Seed Data for Development Environment
-- Description: Adds a test user, project, and initial data only if they don't exist.
-- Usage: psql -d carbonscribe_portal -f internal/database/seeds/001_dev_seed.sql

-- 1. Create a default admin user
INSERT INTO users (id, email, full_name, role) 
VALUES (
    '00000000-0000-0000-0000-000000000001', 
    'admin@carbonscribe.com', 
    'Admin User', 
    'admin'
) 
ON CONFLICT (email) DO NOTHING;

-- 2. Create a default project
INSERT INTO projects (id, name, description, status) 
VALUES (
    '00000000-0000-0000-0000-000000000002', 
    'Reforestation Project Alpha', 
    'A pilot reforestation project in the Amazon basin designed to test carbon sequestration metrics.', 
    'active'
) 
ON CONFLICT (id) DO NOTHING;

-- 3. Create some sample carbon credits for the project
INSERT INTO carbon_credits (
    id, project_id, vintage_year, calculation_period_start, calculation_period_end, 
    methodology_code, calculated_tons, buffered_tons, issued_tons, 
    data_quality_score, status, stellar_asset_code, stellar_asset_issuer
) 
VALUES 
(
    gen_random_uuid(), 
    '00000000-0000-0000-0000-000000000002', 
    2024, 
    '2024-01-01', 
    '2024-12-31', 
    'VM0007', 
    1500.00, 
    1350.00, 
    1350.00, 
    0.95, 
    'minted', 
    'CARBON2024', 
    'GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789'
),
(
    gen_random_uuid(), 
    '00000000-0000-0000-0000-000000000002', 
    2025, 
    '2025-01-01', 
    '2025-12-31', 
    'VM0007', 
    1800.00, 
    1620.00, 
    NULL, 
    0.92, 
    'calculated', 
    NULL, 
    NULL
)
ON CONFLICT DO NOTHING; -- Assuming random UUIDs usually don't conflict, but safe to run repeatedly

-- 4. Create sample revenue transactions
INSERT INTO payment_transactions (
    id, user_id, project_id, amount, currency, 
    payment_method, payment_provider, status, 
    created_at
)
VALUES
(
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    5000.00,
    'USD',
    'credit_card',
    'stripe',
    'completed',
    NOW() - INTERVAL '2 days'
),
(
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    12500.00,
    'USD',
    'bank_transfer',
    'stripe',
    'completed',
    NOW() - INTERVAL '5 days'
);
