-- Migration: 011_geospatial_tables
-- Description: Geospatial & map data service tables (PostGIS)
-- Date: 2026-02-23

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

CREATE TABLE IF NOT EXISTS project_geometries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,

    geometry GEOGRAPHY(GEOMETRY, 4326) NOT NULL,
    centroid GEOGRAPHY(POINT, 4326) NOT NULL,
    bounding_box GEOGRAPHY(POLYGON, 4326),

    area_hectares DECIMAL(12, 4) NOT NULL,
    perimeter_meters DECIMAL(12, 4),

    is_valid BOOLEAN DEFAULT TRUE,
    validation_errors TEXT[],
    simplification_tolerance DECIMAL(10, 6),

    source_type VARCHAR(50) DEFAULT 'manual',
    source_file VARCHAR(500),
    accuracy_score DECIMAL(3, 2),

    version INTEGER DEFAULT 1,
    previous_version_id UUID REFERENCES project_geometries(id),

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_geometries_geometry ON project_geometries USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_project_geometries_centroid ON project_geometries USING GIST (centroid);

CREATE TABLE IF NOT EXISTS administrative_boundaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    admin_level INTEGER NOT NULL,
    country_code CHAR(2),

    geometry GEOGRAPHY(MULTIPOLYGON, 4326) NOT NULL,
    centroid GEOGRAPHY(POINT, 4326),

    source VARCHAR(100) DEFAULT 'natural_earth',
    source_version VARCHAR(50),

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_boundaries_geometry ON administrative_boundaries USING GIST (geometry);

CREATE TABLE IF NOT EXISTS geofences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,

    geometry GEOGRAPHY(POLYGON, 4326) NOT NULL,
    geofence_type VARCHAR(50) NOT NULL,

    alert_rules JSONB NOT NULL DEFAULT '{"on_enter":true,"on_exit":false,"on_proximity":true,"proximity_meters":1000}',

    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 1,

    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_geofences_geometry ON geofences USING GIST (geometry);

CREATE TABLE IF NOT EXISTS geofence_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    geofence_id UUID NOT NULL REFERENCES geofences(id),
    project_id UUID NOT NULL REFERENCES projects(id),

    event_type VARCHAR(50) NOT NULL,
    distance_meters DECIMAL(10, 2),

    location GEOGRAPHY(POINT, 4326),

    alert_generated BOOLEAN DEFAULT FALSE,
    alert_id UUID,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS map_tile_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tile_key VARCHAR(500) UNIQUE NOT NULL,
    tile_data BYTEA NOT NULL,
    content_type VARCHAR(50) NOT NULL,

    map_style VARCHAR(100),
    zoom_level INTEGER,
    x_coordinate INTEGER,
    y_coordinate INTEGER,

    accessed_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_map_tile_cache_key ON map_tile_cache (tile_key);
CREATE INDEX IF NOT EXISTS idx_map_tile_cache_expiry ON map_tile_cache (expires_at);
