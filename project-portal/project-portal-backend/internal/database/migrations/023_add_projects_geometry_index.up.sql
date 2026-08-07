-- Migration: 023_add_projects_geometry_index
-- Description: Add geometry column and GIST spatial index to projects table
-- Date: 2026-08-07

-- Add geometry column to projects table for direct spatial queries
ALTER TABLE projects ADD COLUMN IF NOT EXISTS geometry GEOGRAPHY(GEOMETRY, 4326);

-- Create GIST spatial index on the projects geometry column
-- This enables efficient spatial intersection, proximity, and containment queries
-- directly on the projects table without requiring a JOIN to project_geometries
CREATE INDEX IF NOT EXISTS idx_projects_geometry ON projects USING GIST (geometry);
