package geospatial

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/geospatial/queries"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
)

type Repository interface {
	UpsertProjectGeometry(ctx context.Context, projectID uuid.UUID, req UploadGeometryRequest) (*ProjectGeometry, error)
	GetProjectGeometry(ctx context.Context, projectID uuid.UUID) (*ProjectGeometry, error)
	GetProjectBoundary(ctx context.Context, projectID uuid.UUID, format string) (*BoundaryResponse, error)
	FindNearby(ctx context.Context, q NearbyQuery) ([]NearbyProject, error)
	FindWithin(ctx context.Context, q WithinQuery) ([]NearbyProject, error)
	Intersect(ctx context.Context, geometry json.RawMessage) ([]IntersectResult, error)

	CreateGeofence(ctx context.Context, req CreateGeofenceRequest) (*Geofence, error)
	CheckProjectGeofences(ctx context.Context, projectID uuid.UUID) ([]GeofenceCheckResult, error)
	GetAdministrativeBoundaries(ctx context.Context, level int, countryCode string) ([]AdministrativeBoundary, error)

	GetCachedTile(ctx context.Context, tileKey string) ([]byte, string, bool, error)
	PutCachedTile(ctx context.Context, tileKey string, data []byte, contentType, style string, z, x, y int, ttl time.Duration) error
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) UpsertProjectGeometry(ctx context.Context, projectID uuid.UUID, req UploadGeometryRequest) (*ProjectGeometry, error) {
	sourceType := req.SourceType
	if sourceType == "" {
		sourceType = "manual"
	}

	var tolerance *float64
	if req.SimplificationTolerance != nil && *req.SimplificationTolerance > 0 {
		tolerance = req.SimplificationTolerance
	}

	sqlStmt := `
WITH input AS (
  SELECT ST_SetSRID(ST_GeomFromGeoJSON(?), 4326) AS raw_geom
),
normalized AS (
  SELECT
    CASE
      WHEN ?::double precision IS NULL OR ?::double precision <= 0 THEN raw_geom
      ELSE ST_SimplifyPreserveTopology(raw_geom, ?::double precision)
    END AS geom
  FROM input
)
INSERT INTO project_geometries (
  project_id,
  geometry,
  centroid,
  bounding_box,
  area_hectares,
  perimeter_meters,
  is_valid,
  validation_errors,
  simplification_tolerance,
  source_type,
  source_file,
  accuracy_score,
  version,
  previous_version_id,
  created_at,
  updated_at
)
SELECT
  ?,
  geom::geography,
  ST_Centroid(geom)::geography,
  ST_Envelope(geom)::geography,
  ST_Area(geom::geography) * 0.0001,
  CASE
    WHEN GeometryType(geom) IN ('POLYGON', 'MULTIPOLYGON') THEN ST_Perimeter(geom::geography)
    ELSE ST_Length(geom::geography)
  END,
  ST_IsValid(geom),
  CASE WHEN ST_IsValid(geom) THEN ARRAY[]::text[] ELSE ARRAY[ST_IsValidReason(geom)] END,
  ?,
  ?,
  ?,
  ?,
  1,
  NULL,
  NOW(),
  NOW()
FROM normalized
ON CONFLICT (project_id)
DO UPDATE SET
  previous_version_id = project_geometries.id,
  geometry = EXCLUDED.geometry,
  centroid = EXCLUDED.centroid,
  bounding_box = EXCLUDED.bounding_box,
  area_hectares = EXCLUDED.area_hectares,
  perimeter_meters = EXCLUDED.perimeter_meters,
  is_valid = EXCLUDED.is_valid,
  validation_errors = EXCLUDED.validation_errors,
  simplification_tolerance = EXCLUDED.simplification_tolerance,
  source_type = EXCLUDED.source_type,
  source_file = EXCLUDED.source_file,
  accuracy_score = EXCLUDED.accuracy_score,
  version = project_geometries.version + 1,
  updated_at = NOW()
`
	if err := r.db.WithContext(ctx).Exec(
		sqlStmt,
		string(req.GeoJSON),
		tolerance,
		tolerance,
		tolerance,
		projectID,
		req.SimplificationTolerance,
		sourceType,
		req.SourceFile,
		req.AccuracyScore,
	).Error; err != nil {
		return nil, fmt.Errorf("upsert project geometry: %w", err)
	}

	return r.GetProjectGeometry(ctx, projectID)
}

func (r *repository) GetProjectGeometry(ctx context.Context, projectID uuid.UUID) (*ProjectGeometry, error) {
	row := r.db.WithContext(ctx).Raw(queries.GeometryByProjectSQL(), projectID).Row()
	var out ProjectGeometry
	var geom, centroid, bbox sql.NullString
	var sourceFile sql.NullString
	var acc sql.NullFloat64
	var prevID sql.NullString
	var tolerance sql.NullFloat64
	var validationErrors pq.StringArray
	if err := row.Scan(
		&out.ID,
		&out.ProjectID,
		&geom,
		&centroid,
		&bbox,
		&out.AreaHectares,
		&out.PerimeterMeters,
		&out.IsValid,
		&validationErrors,
		&tolerance,
		&out.SourceType,
		&sourceFile,
		&acc,
		&out.Version,
		&prevID,
		&out.CreatedAt,
		&out.UpdatedAt,
	); err != nil {
		return nil, err
	}
	out.ValidationErrors = []string(validationErrors)
	if geom.Valid {
		out.GeometryGeoJSON = json.RawMessage(geom.String)
	}
	if centroid.Valid {
		out.CentroidGeoJSON = json.RawMessage(centroid.String)
	}
	if bbox.Valid {
		out.BoundingBoxGeoJSON = json.RawMessage(bbox.String)
	}
	if sourceFile.Valid {
		out.SourceFile = sourceFile.String
	}
	if acc.Valid {
		v := acc.Float64
		out.AccuracyScore = &v
	}
	if tolerance.Valid {
		v := tolerance.Float64
		out.SimplificationTolerance = &v
	}
	if prevID.Valid {
		if id, err := uuid.Parse(prevID.String); err == nil {
			out.PreviousVersionID = &id
		}
	}

	return &out, nil
}

func (r *repository) GetProjectBoundary(ctx context.Context, projectID uuid.UUID, format string) (*BoundaryResponse, error) {
	if format == "" {
		format = BoundaryFormatGeoJSON
	}

	resp := &BoundaryResponse{ProjectID: projectID, Format: format}
	var row *sql.Row
	switch format {
	case BoundaryFormatWKT:
		row = r.db.WithContext(ctx).Raw(`
SELECT ST_AsText(geometry::geometry), area_hectares, perimeter_meters
FROM project_geometries WHERE project_id = ?
`, projectID).Row()
		if err := row.Scan(&resp.WKT, &resp.AreaHectares, &resp.PerimeterMeters); err != nil {
			return nil, err
		}
	case BoundaryFormatKML:
		row = r.db.WithContext(ctx).Raw(`
SELECT ST_AsKML(geometry::geometry), area_hectares, perimeter_meters
FROM project_geometries WHERE project_id = ?
`, projectID).Row()
		if err := row.Scan(&resp.KML, &resp.AreaHectares, &resp.PerimeterMeters); err != nil {
			return nil, err
		}
	default:
		var g string
		row = r.db.WithContext(ctx).Raw(`
SELECT ST_AsGeoJSON(geometry::geometry), area_hectares, perimeter_meters
FROM project_geometries WHERE project_id = ?
`, projectID).Row()
		if err := row.Scan(&g, &resp.AreaHectares, &resp.PerimeterMeters); err != nil {
			return nil, err
		}
		resp.Geometry = json.RawMessage(g)
	}
	return resp, nil
}

func (r *repository) FindNearby(ctx context.Context, q NearbyQuery) ([]NearbyProject, error) {
	if q.RadiusMeters <= 0 {
		q.RadiusMeters = 5000
	}
	if q.Limit <= 0 {
		q.Limit = 20
	}

	sqlStmt := queries.NearbyProjectsSQL(q.Limit)
	rows, err := r.db.WithContext(ctx).Raw(sqlStmt, q.Lon, q.Lat, q.Lon, q.Lat, q.RadiusMeters).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]NearbyProject, 0)
	for rows.Next() {
		var p NearbyProject
		if err := rows.Scan(&p.ProjectID, &p.Name, &p.DistanceMeters, &p.Centroid); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, nil
}

func (r *repository) FindWithin(ctx context.Context, q WithinQuery) ([]NearbyProject, error) {
	if q.Limit <= 0 {
		q.Limit = 100
	}

	var (
		rows *sql.Rows
		err  error
	)
	if q.GeoJSON != "" {
		rows, err = r.db.WithContext(ctx).Raw(queries.WithinPolygonSQL(q.Limit), q.GeoJSON).Rows()
	} else {
		rows, err = r.db.WithContext(ctx).Raw(
			queries.WithinBBoxSQL(q.Limit),
			*q.MinLon, *q.MinLat, *q.MaxLon, *q.MaxLat,
		).Rows()
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]NearbyProject, 0)
	for rows.Next() {
		var p NearbyProject
		var centroid string
		if err := rows.Scan(&p.ProjectID, &p.Name, &centroid); err != nil {
			return nil, err
		}
		p.Centroid = centroid
		out = append(out, p)
	}
	return out, nil
}

func (r *repository) Intersect(ctx context.Context, geometry json.RawMessage) ([]IntersectResult, error) {
	rows, err := r.db.WithContext(ctx).Raw(queries.IntersectionSQL, string(geometry), string(geometry), string(geometry)).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]IntersectResult, 0)
	for rows.Next() {
		var i IntersectResult
		if err := rows.Scan(&i.ProjectID, &i.Intersects, &i.IntersectionArea); err != nil {
			return nil, err
		}
		out = append(out, i)
	}
	return out, nil
}

func (r *repository) CreateGeofence(ctx context.Context, req CreateGeofenceRequest) (*Geofence, error) {
	priority := req.Priority
	if priority <= 0 {
		priority = 1
	}
	alertRules := req.AlertRules
	if len(alertRules) == 0 {
		alertRules = json.RawMessage(`{"on_enter":true,"on_exit":false,"on_proximity":true,"proximity_meters":1000}`)
	}
	metadata := req.Metadata
	if len(metadata) == 0 {
		metadata = json.RawMessage(`{}`)
	}

	row := r.db.WithContext(ctx).Raw(`
INSERT INTO geofences (
  name, description, geometry, geofence_type, alert_rules, is_active, priority, metadata, created_at, updated_at
)
VALUES (?, ?, ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)::geography, ?, ?::jsonb, true, ?, ?::jsonb, NOW(), NOW())
RETURNING id, name, description, ST_AsGeoJSON(geometry::geometry), geofence_type, alert_rules, is_active, priority, metadata, created_at, updated_at
`, req.Name, req.Description, string(req.GeoJSON), req.GeofenceType, string(alertRules), priority, string(metadata)).Row()

	var out Geofence
	var geometryStr string
	var desc sql.NullString
	if err := row.Scan(&out.ID, &out.Name, &desc, &geometryStr, &out.GeofenceType, &out.AlertRules, &out.IsActive, &out.Priority, &out.Metadata, &out.CreatedAt, &out.UpdatedAt); err != nil {
		return nil, err
	}
	if desc.Valid {
		out.Description = desc.String
	}
	out.Geometry = json.RawMessage(geometryStr)
	return &out, nil
}

func (r *repository) CheckProjectGeofences(ctx context.Context, projectID uuid.UUID) ([]GeofenceCheckResult, error) {
	rows, err := r.db.WithContext(ctx).Raw(`
SELECT g.id,
       g.name,
       g.geofence_type,
       ST_Intersects(pg.geometry::geometry, g.geometry::geometry) AS intersects,
       ST_Distance(pg.geometry::geography, g.geometry::geography) AS distance_meters,
       g.priority
FROM geofences g
JOIN project_geometries pg ON pg.project_id = ?
WHERE g.is_active = true
ORDER BY g.priority DESC, distance_meters ASC
`, projectID).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]GeofenceCheckResult, 0)
	for rows.Next() {
		var it GeofenceCheckResult
		if err := rows.Scan(&it.GeofenceID, &it.GeofenceName, &it.GeofenceType, &it.Intersects, &it.DistanceMeters, &it.Priority); err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	return out, nil
}

func (r *repository) GetAdministrativeBoundaries(ctx context.Context, level int, countryCode string) ([]AdministrativeBoundary, error) {
	db := r.db.WithContext(ctx)
	sqlStmt := `
SELECT id, name, admin_level, country_code, ST_AsGeoJSON(geometry::geometry)
FROM administrative_boundaries
WHERE admin_level = ?
`
	args := []interface{}{level}
	if countryCode != "" {
		sqlStmt += " AND country_code = ?"
		args = append(args, countryCode)
	}

	rows, err := db.Raw(sqlStmt, args...).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]AdministrativeBoundary, 0)
	for rows.Next() {
		var b AdministrativeBoundary
		if err := rows.Scan(&b.ID, &b.Name, &b.AdminLevel, &b.CountryCode, &b.Geometry); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, nil
}

func (r *repository) GetCachedTile(ctx context.Context, tileKey string) ([]byte, string, bool, error) {
	row := r.db.WithContext(ctx).Raw(`
SELECT tile_data, content_type
FROM map_tile_cache
WHERE tile_key = ? AND expires_at > NOW()
`, tileKey).Row()
	var data []byte
	var contentType string
	if err := row.Scan(&data, &contentType); err != nil {
		if err == sql.ErrNoRows {
			return nil, "", false, nil
		}
		return nil, "", false, err
	}
	_ = r.db.WithContext(ctx).Exec(`
UPDATE map_tile_cache SET accessed_count = accessed_count + 1, last_accessed_at = NOW() WHERE tile_key = ?
`, tileKey).Error
	return data, contentType, true, nil
}

func (r *repository) PutCachedTile(ctx context.Context, tileKey string, data []byte, contentType, style string, z, x, y int, ttl time.Duration) error {
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}
	expiresAt := time.Now().Add(ttl)

	return r.db.WithContext(ctx).Exec(`
INSERT INTO map_tile_cache (
  tile_key, tile_data, content_type, map_style, zoom_level, x_coordinate, y_coordinate, accessed_count, expires_at, created_at
)
VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NOW())
ON CONFLICT (tile_key)
DO UPDATE SET
  tile_data = EXCLUDED.tile_data,
  content_type = EXCLUDED.content_type,
  map_style = EXCLUDED.map_style,
  zoom_level = EXCLUDED.zoom_level,
  x_coordinate = EXCLUDED.x_coordinate,
  y_coordinate = EXCLUDED.y_coordinate,
  expires_at = EXCLUDED.expires_at
`, tileKey, data, contentType, style, z, x, y, expiresAt).Error
}
