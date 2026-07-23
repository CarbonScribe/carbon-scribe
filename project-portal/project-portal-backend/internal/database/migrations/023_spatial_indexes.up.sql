-- Migration: 023_spatial_indexes
-- Description: Add missing PostGIS spatial indexes for query performance
-- Date: 2026-07-23
--
-- Adds GIST, BRIN, and B-tree indexes on geometry columns and filter columns
-- used in spatial queries across project_geometries, geofence_events, and
-- administrative_boundaries.

-- GIST index on geofence_events.location for proximity queries
CREATE INDEX IF NOT EXISTS idx_geofence_events_location
  ON geofence_events USING GIST (location);

-- Composite GIST index on geofence_events for per-geofence spatial lookups
CREATE INDEX IF NOT EXISTS idx_geofence_events_geofence_location
  ON geofence_events USING GIST (geofence_id, location);

-- GIST index on project_geometries.bounding_box for bounding box pre-filtering
-- in spatial queries and map tile rendering
CREATE INDEX IF NOT EXISTS idx_project_geometries_bounding_box
  ON project_geometries USING GIST (bounding_box);

-- Composite GIST index on project_geometries (is_valid, geometry) so spatial
-- intersection queries first filter to valid geometries before the expensive
-- ST_Intersects / ST_DWithin operation
CREATE INDEX IF NOT EXISTS idx_project_geometries_is_valid_geometry
  ON project_geometries USING GIST (is_valid, geometry);

-- BRIN index on project_geometries.area_hectares for efficient range scans
-- (e.g. "projects larger than 1000 ha" or "smallholders under 5 ha")
CREATE INDEX IF NOT EXISTS idx_project_geometries_area_hectares_brin
  ON project_geometries USING BRIN (area_hectares) WITH (pages_per_range = 32);

-- B-tree index on administrative_boundaries.admin_level for WHERE filters
CREATE INDEX IF NOT EXISTS idx_admin_boundaries_admin_level
  ON administrative_boundaries (admin_level);

-- Composite index on administrative_boundaries (admin_level, country_code)
-- for filtered administrative boundary lookups
CREATE INDEX IF NOT EXISTS idx_admin_boundaries_admin_level_country
  ON administrative_boundaries (admin_level, country_code);

-- DESC index on project_geometries.created_at for time-based spatial queries
-- (e.g. "recently added projects in this area")
CREATE INDEX IF NOT EXISTS idx_project_geometries_created_at
  ON project_geometries (created_at DESC);