package geospatial

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/geospatial/geometry"
	pkggeojson "carbon-scribe/project-portal/project-portal-backend/pkg/geojson"

	"github.com/google/uuid"
)

type Service interface {
	UploadProjectGeometry(ctx context.Context, projectID uuid.UUID, req UploadGeometryRequest) (*ProjectGeometry, error)
	GetProjectGeometry(ctx context.Context, projectID uuid.UUID) (*ProjectGeometry, error)
	GetProjectBoundary(ctx context.Context, projectID uuid.UUID, format string) (*BoundaryResponse, error)
	FindNearby(ctx context.Context, q NearbyQuery) ([]NearbyProject, error)
	FindWithin(ctx context.Context, q WithinQuery) ([]NearbyProject, error)
	Intersect(ctx context.Context, req IntersectRequest) ([]IntersectResult, error)
	BuildStaticMapURL(ctx context.Context, req StaticMapRequest) (string, error)
	GetTile(ctx context.Context, z, x, y int, style string) ([]byte, string, bool, error)
	CreateGeofence(ctx context.Context, req CreateGeofenceRequest) (*Geofence, error)
	CheckProjectGeofences(ctx context.Context, projectID uuid.UUID) ([]GeofenceCheckResult, error)
	GetAdministrativeBoundaries(ctx context.Context, level int, countryCode string) ([]AdministrativeBoundary, error)
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) UploadProjectGeometry(ctx context.Context, projectID uuid.UUID, req UploadGeometryRequest) (*ProjectGeometry, error) {
	if len(req.GeoJSON) == 0 {
		return nil, fmt.Errorf("geojson is required")
	}
	if err := pkggeojson.ValidateRFC7946(req.GeoJSON); err != nil {
		return nil, err
	}
	geometryRaw := geometry.ExtractGeometry(req.GeoJSON)
	if err := geometry.ValidateGeoJSON(geometryRaw); err != nil {
		return nil, err
	}
	req.GeoJSON = geometryRaw
	return s.repo.UpsertProjectGeometry(ctx, projectID, req)
}

func (s *service) GetProjectGeometry(ctx context.Context, projectID uuid.UUID) (*ProjectGeometry, error) {
	return s.repo.GetProjectGeometry(ctx, projectID)
}

func (s *service) GetProjectBoundary(ctx context.Context, projectID uuid.UUID, format string) (*BoundaryResponse, error) {
	format = strings.ToLower(strings.TrimSpace(format))
	if format == "" {
		format = BoundaryFormatGeoJSON
	}
	if format != BoundaryFormatGeoJSON && format != BoundaryFormatWKT && format != BoundaryFormatKML {
		return nil, fmt.Errorf("unsupported format: %s", format)
	}
	return s.repo.GetProjectBoundary(ctx, projectID, format)
}

func (s *service) FindNearby(ctx context.Context, q NearbyQuery) ([]NearbyProject, error) {
	if q.RadiusMeters <= 0 {
		q.RadiusMeters = 5000
	}
	if q.Limit <= 0 {
		q.Limit = 20
	}
	return s.repo.FindNearby(ctx, q)
}

func (s *service) FindWithin(ctx context.Context, q WithinQuery) ([]NearbyProject, error) {
	if q.GeoJSON == "" {
		if q.MinLat == nil || q.MinLon == nil || q.MaxLat == nil || q.MaxLon == nil {
			return nil, fmt.Errorf("either geojson polygon or min/max lat/lon bbox is required")
		}
	}
	if q.GeoJSON != "" {
		if err := pkggeojson.ValidateRFC7946([]byte(q.GeoJSON)); err != nil {
			return nil, err
		}
		q.GeoJSON = string(geometry.ExtractGeometry(json.RawMessage(q.GeoJSON)))
	}
	return s.repo.FindWithin(ctx, q)
}

func (s *service) Intersect(ctx context.Context, req IntersectRequest) ([]IntersectResult, error) {
	if err := geometry.ValidateGeoJSON(geometry.ExtractGeometry(req.GeoJSON)); err != nil {
		return nil, err
	}
	return s.repo.Intersect(ctx, geometry.ExtractGeometry(req.GeoJSON))
}

func (s *service) BuildStaticMapURL(ctx context.Context, req StaticMapRequest) (string, error) {
	_ = ctx
	provider := strings.ToLower(req.Provider)
	if provider == "" {
		provider = strings.ToLower(getEnvOrDefault("MAPS_DEFAULT_PROVIDER", "mapbox"))
	}
	if req.Width <= 0 {
		req.Width = atoiOrDefault(os.Getenv("MAPS_STATIC_MAP_WIDTH"), 800)
	}
	if req.Height <= 0 {
		req.Height = atoiOrDefault(os.Getenv("MAPS_STATIC_MAP_HEIGHT"), 600)
	}
	if req.Zoom <= 0 {
		req.Zoom = 10
	}

	switch provider {
	case "google":
		key := os.Getenv("MAPS_GOOGLE_MAPS_API_KEY")
		if key == "" {
			return "", fmt.Errorf("google maps api key is not configured")
		}
		url := fmt.Sprintf("https://maps.googleapis.com/maps/api/staticmap?center=%f,%f&zoom=%.1f&size=%dx%d&maptype=terrain&key=%s", req.Lat, req.Lon, req.Zoom, req.Width, req.Height, key)
		return url, nil
	default:
		token := os.Getenv("MAPS_MAPBOX_ACCESS_TOKEN")
		if token == "" {
			return "", fmt.Errorf("mapbox access token is not configured")
		}
		style := req.Style
		if style == "" {
			style = "satellite-v9"
		}
		url := fmt.Sprintf("https://api.mapbox.com/styles/v1/mapbox/%s/static/%f,%f,%.2f/%dx%d?access_token=%s", style, req.Lon, req.Lat, req.Zoom, req.Width, req.Height, token)
		return url, nil
	}
}

func (s *service) GetTile(ctx context.Context, z, x, y int, style string) ([]byte, string, bool, error) {
	if style == "" {
		style = "streets-v12"
	}
	tileKey := fmt.Sprintf("%d/%d/%d/%s", z, x, y, style)
	cachedData, ct, ok, err := s.repo.GetCachedTile(ctx, tileKey)
	if err != nil {
		return nil, "", false, err
	}
	if ok {
		return cachedData, ct, true, nil
	}

	provider := strings.ToLower(getEnvOrDefault("MAPS_DEFAULT_PROVIDER", "mapbox"))
	payload := map[string]any{
		"provider":  provider,
		"style":     style,
		"tile":      map[string]int{"z": z, "x": x, "y": y},
		"generated": time.Now().UTC().Format(time.RFC3339),
	}
	data, _ := json.Marshal(payload)
	contentType := "application/json"

	ttl := durationOrDefault(os.Getenv("MAPS_TILE_CACHE_TTL"), 24*time.Hour)
	if err := s.repo.PutCachedTile(ctx, tileKey, data, contentType, style, z, x, y, ttl); err != nil {
		return nil, "", false, err
	}

	return data, contentType, false, nil
}

func (s *service) CreateGeofence(ctx context.Context, req CreateGeofenceRequest) (*Geofence, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, fmt.Errorf("name is required")
	}
	if err := geometry.ValidateGeoJSON(geometry.ExtractGeometry(req.GeoJSON)); err != nil {
		return nil, err
	}
	req.GeoJSON = geometry.ExtractGeometry(req.GeoJSON)
	return s.repo.CreateGeofence(ctx, req)
}

func (s *service) CheckProjectGeofences(ctx context.Context, projectID uuid.UUID) ([]GeofenceCheckResult, error) {
	return s.repo.CheckProjectGeofences(ctx, projectID)
}

func (s *service) GetAdministrativeBoundaries(ctx context.Context, level int, countryCode string) ([]AdministrativeBoundary, error) {
	if level < 0 {
		return nil, fmt.Errorf("boundary level must be >= 0")
	}
	countryCode = strings.ToUpper(strings.TrimSpace(countryCode))
	return s.repo.GetAdministrativeBoundaries(ctx, level, countryCode)
}

func getEnvOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func atoiOrDefault(v string, fallback int) int {
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}

func durationOrDefault(v string, fallback time.Duration) time.Duration {
	d, err := time.ParseDuration(v)
	if err != nil {
		return fallback
	}
	return d
}
