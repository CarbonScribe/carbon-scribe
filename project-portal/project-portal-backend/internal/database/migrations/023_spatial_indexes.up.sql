-- Migration: 023_spatial_indexes
-- Description: Add missing GIST/BRIN spatial indexes for geospatial query patterns (issue #431)
-- Date: 2026-08-26

-- btree_gist lets us build composite GIST indexes that mix an equality/range
-- column (uuid, int, bool) with a geography column in a single index scan.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- geofence_events: proximity lookups by location, and per-geofence proximity lookups
CREATE INDEX IF NOT EXISTS idx_geofence_events_location
    ON geofence_events USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_geofence_events_geofence_location
    ON geofence_events USING GIST (geofence_id, location);

CREATE INDEX IF NOT EXISTS idx_geofence_events_created_at
    ON geofence_events USING BRIN (created_at);

-- project_geometries: cover additional spatial query patterns beyond geometry/centroid
CREATE INDEX IF NOT EXISTS idx_project_geometries_bounding_box
    ON project_geometries USING GIST (bounding_box);

CREATE INDEX IF NOT EXISTS idx_project_geometries_valid_geometry
    ON project_geometries USING GIST (is_valid, geometry);

CREATE INDEX IF NOT EXISTS idx_project_geometries_area_hectares
    ON project_geometries USING BRIN (area_hectares);

CREATE INDEX IF NOT EXISTS idx_project_geometries_created_at
    ON project_geometries USING BRIN (created_at);

-- administrative_boundaries: admin_level is almost always filtered alongside
-- the spatial predicate (e.g. "country boundaries that intersect X"), so fold
-- it into the GIST index rather than relying on a separate btree index.
CREATE INDEX IF NOT EXISTS idx_admin_boundaries_level_geometry
    ON administrative_boundaries USING GIST (admin_level, geometry);

-- Note: projects table has no geometry column of its own — its spatial data
-- lives in project_geometries (1:1 via project_id), which is now fully
-- indexed above. Duplicating geometry onto projects would just create a
-- second copy to keep in sync, so we index the existing normalized table
-- instead of adding a column.
--
-- Note: map_tile_cache has no geometry/geography column (tiles are addressed
-- by zoom/x/y, already indexed), so there is nothing spatial to index there.
