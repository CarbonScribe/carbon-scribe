-- Rollback migration for monitoring tables

-- Drop triggers
DROP TRIGGER IF EXISTS update_alerts_updated_at ON alerts;
DROP TRIGGER IF EXISTS update_alert_rules_updated_at ON alert_rules;
DROP TRIGGER IF EXISTS update_sensors_updated_at ON sensors;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS is_alert_in_cooldown(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS get_latest_sensor_reading(VARCHAR);
DROP FUNCTION IF EXISTS calculate_ndvi(DECIMAL, DECIMAL);

-- Drop materialized views (continuous aggregates)
DROP MATERIALIZED VIEW IF EXISTS satellite_observations_daily CASCADE;
DROP MATERIALIZED VIEW IF EXISTS sensor_readings_hourly CASCADE;

-- Drop tables (in reverse order of creation to handle dependencies)
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS alert_rules CASCADE;
DROP TABLE IF EXISTS sensors CASCADE;
DROP TABLE IF EXISTS project_metrics CASCADE;
DROP TABLE IF EXISTS sensor_readings CASCADE;
DROP TABLE IF EXISTS satellite_observations CASCADE;

-- Note: We don't drop extensions as they might be used by other parts of the system
-- DROP EXTENSION IF EXISTS "postgis";
-- DROP EXTENSION IF EXISTS "timescaledb";
-- DROP EXTENSION IF EXISTS "uuid-ossp";
