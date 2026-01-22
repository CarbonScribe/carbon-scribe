-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Projects table (reference - should exist from earlier migrations)
-- This is just a reference, not creating it here
-- CREATE TABLE IF NOT EXISTS projects (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     name VARCHAR(255) NOT NULL,
--     created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
-- );

-- Users table (reference - should exist from earlier migrations)
-- CREATE TABLE IF NOT EXISTS users (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     email VARCHAR(255) NOT NULL UNIQUE,
--     created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
-- );

-- =============================================
-- SATELLITE OBSERVATIONS HYPERTABLE
-- =============================================
CREATE TABLE IF NOT EXISTS satellite_observations (
    time TIMESTAMPTZ NOT NULL,
    project_id UUID NOT NULL, -- REFERENCES projects(id),
    satellite_source VARCHAR(50) NOT NULL, -- 'sentinel2', 'planet', 'landsat', 'modis'
    tile_id VARCHAR(50), -- Satellite tile identifier
    ndvi DECIMAL(5,4), -- Normalized Difference Vegetation Index (-1 to 1)
    evi DECIMAL(5,4), -- Enhanced Vegetation Index
    ndwi DECIMAL(5,4), -- Normalized Difference Water Index
    savi DECIMAL(5,4), -- Soil Adjusted Vegetation Index
    biomass_kg_per_ha DECIMAL(10,2), -- Estimated biomass in kg per hectare
    cloud_coverage_percent DECIMAL(5,2), -- Cloud coverage percentage (0-100)
    data_quality_score DECIMAL(3,2), -- Quality score (0-1)
    geometry GEOGRAPHY(POLYGON, 4326), -- Spatial footprint of the observation
    raw_bands JSONB DEFAULT '{}', -- Raw spectral band values
    metadata JSONB DEFAULT '{}', -- Additional metadata (resolution, processing level, etc.)
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Convert to hypertable with 7-day chunks (satellite revisit is typically 5-16 days)
SELECT create_hypertable('satellite_observations', 'time', 
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Indexes for satellite observations
CREATE INDEX IF NOT EXISTS idx_satellite_obs_project_time 
    ON satellite_observations (project_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_satellite_obs_source 
    ON satellite_observations (satellite_source, time DESC);
CREATE INDEX IF NOT EXISTS idx_satellite_obs_quality 
    ON satellite_observations (data_quality_score, time DESC) 
    WHERE data_quality_score > 0.7;
CREATE INDEX IF NOT EXISTS idx_satellite_obs_geometry 
    ON satellite_observations USING GIST (geometry);

-- =============================================
-- IOT SENSOR READINGS HYPERTABLE
-- =============================================
CREATE TABLE IF NOT EXISTS sensor_readings (
    time TIMESTAMPTZ NOT NULL,
    project_id UUID NOT NULL, -- REFERENCES projects(id),
    sensor_id VARCHAR(100) NOT NULL, -- Unique sensor device identifier
    sensor_type VARCHAR(50) NOT NULL, -- 'soil_moisture', 'temperature', 'co2', 'rainfall', 'humidity', 'ph'
    value DECIMAL(10,4) NOT NULL, -- Sensor reading value
    unit VARCHAR(20) NOT NULL, -- Measurement unit (e.g., 'celsius', 'percent', 'ppm')
    latitude DECIMAL(10,8), -- Sensor location latitude
    longitude DECIMAL(11,8), -- Sensor location longitude
    altitude_m DECIMAL(8,2), -- Altitude in meters
    battery_level DECIMAL(5,2), -- Battery level percentage (0-100)
    signal_strength INTEGER, -- Signal strength in dBm or percentage
    data_quality VARCHAR(20) DEFAULT 'good', -- 'excellent', 'good', 'fair', 'poor'
    metadata JSONB DEFAULT '{}', -- Calibration data, edge processing info, etc.
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Convert to hypertable with 1-day chunks (IoT data is high frequency)
SELECT create_hypertable('sensor_readings', 'time', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Indexes for sensor readings
CREATE INDEX IF NOT EXISTS idx_sensor_readings_composite 
    ON sensor_readings (project_id, sensor_type, time DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor_id 
    ON sensor_readings (sensor_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_type_time 
    ON sensor_readings (sensor_type, time DESC);

-- =============================================
-- PROJECT METRICS (PRE-AGGREGATED) HYPERTABLE
-- =============================================
CREATE TABLE IF NOT EXISTS project_metrics (
    time TIMESTAMPTZ NOT NULL,
    project_id UUID NOT NULL, -- REFERENCES projects(id),
    metric_name VARCHAR(100) NOT NULL, -- 'carbon_sequestration_daily', 'vegetation_health', 'water_retention', etc.
    value DECIMAL(12,4) NOT NULL, -- Calculated metric value
    aggregation_period VARCHAR(20) NOT NULL, -- 'raw', 'hourly', 'daily', 'weekly', 'monthly'
    calculation_method VARCHAR(100), -- 'direct_measurement', 'modeled', 'interpolated', 'satellite_derived'
    confidence_score DECIMAL(3,2), -- Confidence in the calculation (0-1)
    unit VARCHAR(50), -- Metric unit
    metadata JSONB DEFAULT '{}', -- Calculation parameters, data sources, etc.
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (time, project_id, metric_name, aggregation_period)
);

-- Convert to hypertable with 7-day chunks
SELECT create_hypertable('project_metrics', 'time', 
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Indexes for project metrics
CREATE INDEX IF NOT EXISTS idx_project_metrics_project 
    ON project_metrics (project_id, metric_name, aggregation_period, time DESC);
CREATE INDEX IF NOT EXISTS idx_project_metrics_name 
    ON project_metrics (metric_name, time DESC);

-- =============================================
-- SENSOR REGISTRY
-- =============================================
CREATE TABLE IF NOT EXISTS sensors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sensor_id VARCHAR(100) NOT NULL UNIQUE, -- Physical sensor identifier
    project_id UUID NOT NULL, -- REFERENCES projects(id),
    name VARCHAR(255) NOT NULL,
    sensor_type VARCHAR(50) NOT NULL,
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    firmware_version VARCHAR(50),
    installation_date TIMESTAMPTZ,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    altitude_m DECIMAL(8,2),
    depth_cm DECIMAL(6,2), -- For soil sensors
    calibration_data JSONB DEFAULT '{}', -- Calibration coefficients and parameters
    communication_protocol VARCHAR(50), -- 'mqtt', 'http', 'lorawan', 'nb-iot'
    reporting_interval_seconds INTEGER DEFAULT 300, -- How often sensor reports
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'maintenance', 'decommissioned'
    last_seen_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sensors_project ON sensors (project_id);
CREATE INDEX IF NOT EXISTS idx_sensors_type ON sensors (sensor_type);
CREATE INDEX IF NOT EXISTS idx_sensors_status ON sensors (status) WHERE status = 'active';

-- =============================================
-- ALERT RULES
-- =============================================
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID, -- REFERENCES projects(id) ON DELETE CASCADE, NULL for global rules
    name VARCHAR(255) NOT NULL,
    description TEXT,
    condition_type VARCHAR(50) NOT NULL, -- 'threshold', 'rate_of_change', 'data_gap', 'anomaly'
    metric_source VARCHAR(100) NOT NULL, -- 'satellite', 'sensor', 'calculated'
    metric_name VARCHAR(100) NOT NULL, -- Specific metric to monitor
    sensor_type VARCHAR(50), -- For sensor-based rules
    condition_config JSONB NOT NULL, -- Threshold values, time windows, comparison operators
    severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    notification_channels JSONB DEFAULT '["email"]', -- ['email', 'sms', 'webhook', 'in_app']
    cooldown_minutes INTEGER DEFAULT 60, -- Minimum time between repeated alerts
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID, -- REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_project ON alert_rules (project_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_alert_rules_active ON alert_rules (is_active, metric_source);

-- =============================================
-- ALERTS (TRIGGERED ALERTS HISTORY)
-- =============================================
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID, -- REFERENCES alert_rules(id), NULL if manually created
    project_id UUID NOT NULL, -- REFERENCES projects(id),
    trigger_time TIMESTAMPTZ NOT NULL,
    resolved_time TIMESTAMPTZ,
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}', -- Metric values, thresholds breached, etc.
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'acknowledged', 'resolved', 'false_positive'
    acknowledged_by UUID, -- REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_by UUID, -- REFERENCES users(id),
    resolution_notes TEXT,
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_attempts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alerts_project_status ON alerts (project_id, status, trigger_time DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts (status, trigger_time DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts (severity, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_alerts_rule ON alerts (rule_id, trigger_time DESC);

-- =============================================
-- CONTINUOUS AGGREGATES (TimescaleDB feature)
-- Pre-compute common aggregations for performance
-- =============================================

-- Hourly sensor data aggregates
CREATE MATERIALIZED VIEW IF NOT EXISTS sensor_readings_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    project_id,
    sensor_id,
    sensor_type,
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    STDDEV(value) AS stddev_value,
    COUNT(*) AS reading_count
FROM sensor_readings
GROUP BY bucket, project_id, sensor_id, sensor_type
WITH NO DATA;

-- Refresh policy: update hourly aggregates every 30 minutes
SELECT add_continuous_aggregate_policy('sensor_readings_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '30 minutes',
    if_not_exists => TRUE
);

-- Daily satellite observation aggregates
CREATE MATERIALIZED VIEW IF NOT EXISTS satellite_observations_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS bucket,
    project_id,
    satellite_source,
    AVG(ndvi) AS avg_ndvi,
    MAX(ndvi) AS max_ndvi,
    MIN(ndvi) AS min_ndvi,
    AVG(biomass_kg_per_ha) AS avg_biomass,
    AVG(cloud_coverage_percent) AS avg_cloud_coverage,
    COUNT(*) AS observation_count
FROM satellite_observations
WHERE data_quality_score > 0.5
GROUP BY bucket, project_id, satellite_source
WITH NO DATA;

-- Refresh policy: update daily aggregates once per day
SELECT add_continuous_aggregate_policy('satellite_observations_daily',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- =============================================
-- DATA RETENTION POLICIES
-- Automatically compress and drop old data
-- =============================================

-- Compress satellite data older than 30 days
SELECT add_compression_policy('satellite_observations', 
    INTERVAL '30 days',
    if_not_exists => TRUE
);

-- Compress sensor readings older than 14 days
SELECT add_compression_policy('sensor_readings', 
    INTERVAL '14 days',
    if_not_exists => TRUE
);

-- Drop raw sensor readings older than 2 years (aggregates are kept)
SELECT add_retention_policy('sensor_readings', 
    INTERVAL '2 years',
    if_not_exists => TRUE
);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to calculate NDVI from Red and NIR bands
CREATE OR REPLACE FUNCTION calculate_ndvi(red DECIMAL, nir DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    IF (nir + red) = 0 THEN
        RETURN NULL;
    END IF;
    RETURN (nir - red) / (nir + red);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get latest sensor reading for a sensor
CREATE OR REPLACE FUNCTION get_latest_sensor_reading(p_sensor_id VARCHAR)
RETURNS TABLE (
    time TIMESTAMPTZ,
    value DECIMAL,
    unit VARCHAR,
    data_quality VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT sr.time, sr.value, sr.unit, sr.data_quality
    FROM sensor_readings sr
    WHERE sr.sensor_id = p_sensor_id
    ORDER BY sr.time DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if alert is in cooldown period
CREATE OR REPLACE FUNCTION is_alert_in_cooldown(
    p_rule_id UUID,
    p_project_id UUID,
    p_cooldown_minutes INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    last_alert_time TIMESTAMPTZ;
BEGIN
    SELECT MAX(trigger_time) INTO last_alert_time
    FROM alerts
    WHERE rule_id = p_rule_id 
      AND project_id = p_project_id
      AND status != 'false_positive';
    
    IF last_alert_time IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN (CURRENT_TIMESTAMP - last_alert_time) < (p_cooldown_minutes || ' minutes')::INTERVAL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_sensors_updated_at BEFORE UPDATE ON sensors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON alert_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE satellite_observations IS 'Time-series data from satellite imagery including vegetation indices and biomass estimates';
COMMENT ON TABLE sensor_readings IS 'High-frequency time-series data from IoT sensors deployed at project sites';
COMMENT ON TABLE project_metrics IS 'Pre-calculated aggregated metrics for project performance tracking';
COMMENT ON TABLE sensors IS 'Registry of all IoT sensors with metadata and configuration';
COMMENT ON TABLE alert_rules IS 'Configurable alert rules for monitoring conditions';
COMMENT ON TABLE alerts IS 'History of triggered alerts with acknowledgment and resolution tracking';
