package queries

func GeometryByProjectSQL() string {
	return `
SELECT id,
       project_id,
       ST_AsGeoJSON(geometry::geometry) AS geometry_geojson,
       ST_AsGeoJSON(centroid::geometry) AS centroid_geojson,
       ST_AsGeoJSON(bounding_box::geometry) AS bounding_box_geojson,
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
FROM project_geometries
WHERE project_id = ?
`
}
