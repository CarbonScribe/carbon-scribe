package queries

const IntersectionSQL = `
SELECT pg.project_id,
       ST_Intersects(pg.geometry::geometry, ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)) AS intersects,
       CASE
         WHEN ST_Intersects(pg.geometry::geometry, ST_SetSRID(ST_GeomFromGeoJSON(?), 4326))
         THEN ST_Area(
           ST_Intersection(pg.geometry::geometry, ST_SetSRID(ST_GeomFromGeoJSON(?), 4326))::geography
         ) * 0.0001
         ELSE 0
       END AS intersection_area_hectares
FROM project_geometries pg
`
