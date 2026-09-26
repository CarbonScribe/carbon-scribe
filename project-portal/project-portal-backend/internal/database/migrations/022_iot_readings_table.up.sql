-- Create iot_readings table for IoT sensor data
CREATE TABLE IF NOT EXISTS iot_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sensor_id VARCHAR(100) NOT NULL,
    sensor_type VARCHAR(100) NOT NULL,
    value DECIMAL(15,6) NOT NULL,
    unit VARCHAR(50),
    location JSONB,
    metadata JSONB,
    device_id VARCHAR(100),
    battery_level DECIMAL(5,2),
    signal_strength INTEGER,
    captured_at TIMESTAMPTZ NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for query performance
CREATE INDEX idx_iot_readings_project_id ON iot_readings(project_id);
CREATE INDEX idx_iot_readings_sensor_id ON iot_readings(sensor_id);
CREATE INDEX idx_iot_readings_sensor_type ON iot_readings(sensor_type);
CREATE INDEX idx_iot_readings_captured_at ON iot_readings(captured_at DESC);
CREATE INDEX idx_iot_readings_device_id ON iot_readings(device_id);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('iot_readings', 'captured_at', if_not_exists => TRUE);

-- Add compression policy for older data (optional)
-- ALTER TABLE iot_readings SET (
--   timescaledb.compress,
--   timescaledb.compress_segmentby = 'project_id, sensor_id',
--   timescaledb.compress_orderby = 'captured_at DESC'
-- );