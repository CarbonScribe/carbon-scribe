package queries

import "fmt"

func NearbyProjectsSQL(limit int) string {
	if limit <= 0 {
		limit = 20
	}
	return fmt.Sprintf(`
SELECT p.id AS project_id,
       p.name,
       ST_Distance(pg.centroid::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography) AS distance_meters,
       ST_AsGeoJSON(pg.centroid::geometry) AS centroid_geojson
FROM project_geometries pg
JOIN projects p ON p.id = pg.project_id
WHERE ST_DWithin(pg.centroid::geometry::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geometry::geography, ?)
ORDER BY distance_meters ASC
LIMIT %d
`, limit)
}

func WithinBBoxSQL(limit int) string {
	if limit <= 0 {
		limit = 100
	}
	return fmt.Sprintf(`
SELECT p.id AS project_id,
       p.name,
       ST_AsGeoJSON(pg.centroid::geometry) AS centroid_geojson
FROM project_geometries pg
JOIN projects p ON p.id = pg.project_id
WHERE ST_Intersects(
  pg.geometry::geometry,
  ST_MakeEnvelope(?, ?, ?, ?, 4326)
)
LIMIT %d
`, limit)
}

func WithinPolygonSQL(limit int) string {
	if limit <= 0 {
		limit = 100
	}
	return fmt.Sprintf(`
SELECT p.id AS project_id,
       p.name,
       ST_AsGeoJSON(pg.centroid::geometry) AS centroid_geojson
FROM project_geometries pg
JOIN projects p ON p.id = pg.project_id
WHERE ST_Intersects(
  pg.geometry::geometry,
  ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)
)
LIMIT %d
`, limit)
}
