package maps

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"math"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
)

const (
	TileSize    = 256
	EarthRadius = 6378137
	MinLat      = -85.05112878
	MaxLat      = 85.05112878
	MinLon      = -180
	MaxLon      = 180

	StyleSatellite = "satellite"
	StyleTerrain   = "terrain"
	StyleBoundary  = "boundary"
	StyleHybrid    = "hybrid"
	StyleLight     = "light"
	StyleDark      = "dark"
	StyleStreets   = "streets"

	FormatPNG  = "png"
	FormatJPEG = "jpeg"
	FormatMVT  = "mvt"
)

type TileCoord struct {
	Z, X, Y int
}

type Bounds struct {
	MinLon, MinLat, MaxLon, MaxLat float64
}

type Coord struct {
	Lon, Lat float64
}

type GeometryJSON struct {
	Type        string          `json:"type"`
	Coordinates json.RawMessage `json:"coordinates"`
}

type FeatureCollection struct {
	Type     string          `json:"type"`
	Features []Feature       `json:"features"`
}

type Feature struct {
	Type       string          `json:"type"`
	Geometry   GeometryJSON    `json:"geometry"`
	Properties json.RawMessage `json:"properties"`
}

type StyleConfig struct {
	Name            string
	BackgroundColor color.NRGBA
	FillColor       color.NRGBA
	StrokeColor     color.NRGBA
	StrokeWidth     int
	FillOpacity     float64
}

var (
	styleConfigs = map[string]StyleConfig{
		StyleSatellite: {
			Name:            StyleSatellite,
			BackgroundColor: color.NRGBA{R: 28, G: 28, B: 28, A: 255},
			FillColor:       color.NRGBA{R: 0, G: 255, B: 0, A: 255},
			StrokeColor:     color.NRGBA{R: 0, G: 200, B: 0, A: 255},
			StrokeWidth:     2,
			FillOpacity:     0.3,
		},
		StyleTerrain: {
			Name:            StyleTerrain,
			BackgroundColor: color.NRGBA{R: 242, G: 239, B: 233, A: 255},
			FillColor:       color.NRGBA{R: 34, G: 139, B: 34, A: 255},
			StrokeColor:     color.NRGBA{R: 0, G: 100, B: 0, A: 255},
			StrokeWidth:     2,
			FillOpacity:     0.5,
		},
		StyleBoundary: {
			Name:            StyleBoundary,
			BackgroundColor: color.NRGBA{R: 255, G: 255, B: 255, A: 255},
			FillColor:       color.NRGBA{R: 66, G: 133, B: 244, A: 255},
			StrokeColor:     color.NRGBA{R: 33, G: 100, B: 200, A: 255},
			StrokeWidth:     3,
			FillOpacity:     0.25,
		},
		StyleHybrid: {
			Name:            StyleHybrid,
			BackgroundColor: color.NRGBA{R: 28, G: 28, B: 28, A: 255},
			FillColor:       color.NRGBA{R: 255, G: 200, B: 0, A: 255},
			StrokeColor:     color.NRGBA{R: 255, G: 255, B: 0, A: 255},
			StrokeWidth:     2,
			FillOpacity:     0.4,
		},
		StyleLight: {
			Name:            StyleLight,
			BackgroundColor: color.NRGBA{R: 248, G: 249, B: 250, A: 255},
			FillColor:       color.NRGBA{R: 52, G: 168, B: 83, A: 255},
			StrokeColor:     color.NRGBA{R: 30, G: 120, B: 60, A: 255},
			StrokeWidth:     2,
			FillOpacity:     0.35,
		},
		StyleDark: {
			Name:            StyleDark,
			BackgroundColor: color.NRGBA{R: 18, G: 18, B: 18, A: 255},
			FillColor:       color.NRGBA{R: 0, G: 200, B: 83, A: 255},
			StrokeColor:     color.NRGBA{R: 0, G: 150, B: 60, A: 255},
			StrokeWidth:     2,
			FillOpacity:     0.4,
		},
		StyleStreets: {
			Name:            StyleStreets,
			BackgroundColor: color.NRGBA{R: 235, G: 235, B: 235, A: 255},
			FillColor:       color.NRGBA{R: 76, G: 175, B: 80, A: 255},
			StrokeColor:     color.NRGBA{R: 27, G: 94, B: 32, A: 255},
			StrokeWidth:     2,
			FillOpacity:     0.3,
		},
	}
)

type TileCache struct {
	mu    sync.RWMutex
	store map[string]*cacheEntry
	ttl   time.Duration
}

type cacheEntry struct {
	data       []byte
	contentType string
	expiresAt  time.Time
}

func NewTileCache(ttl time.Duration) *TileCache {
	if ttl <= 0 {
		ttl = 15 * time.Minute
	}
	return &TileCache{
		store: make(map[string]*cacheEntry),
		ttl:   ttl,
	}
}

func (tc *TileCache) Get(key string) ([]byte, string, bool) {
	tc.mu.RLock()
	defer tc.mu.RUnlock()
	entry, ok := tc.store[key]
	if !ok || time.Now().After(entry.expiresAt) {
		return nil, "", false
	}
	return entry.data, entry.contentType, true
}

func (tc *TileCache) Set(key string, data []byte, contentType string) {
	tc.mu.Lock()
	defer tc.mu.Unlock()
	tc.store[key] = &cacheEntry{
		data:       data,
		contentType: contentType,
		expiresAt:  time.Now().Add(tc.ttl),
	}
}

func (tc *TileCache) Clear() {
	tc.mu.Lock()
	defer tc.mu.Unlock()
	tc.store = make(map[string]*cacheEntry)
}

var DefaultTileCache = NewTileCache(15 * time.Minute)

func TileKey(z, x, y int, style string) string {
	return fmt.Sprintf("%d/%d/%d/%s", z, x, y, style)
}

func TileKeyWithFormat(z, x, y int, style, format string) string {
	return fmt.Sprintf("%d/%d/%d/%s/%s", z, x, y, style, format)
}

func GetStyleConfig(style string) StyleConfig {
	if cfg, ok := styleConfigs[style]; ok {
		return cfg
	}
	return styleConfigs[StyleStreets]
}

func TileToBBox(z, x, y int) Bounds {
	n := math.Pow(2, float64(z))
	minLon := float64(x)/n*360.0 - 180.0
	maxLon := (float64(x)+1)/n*360.0 - 180.0
	minLat := math.Atan(math.Sinh(math.Pi*(1-2*float64(y+1)/n))) * 180.0 / math.Pi
	maxLat := math.Atan(math.Sinh(math.Pi*(1-2*float64(y)/n))) * 180.0 / math.Pi
	return Bounds{
		MinLon: minLon,
		MinLat: minLat,
		MaxLon: maxLon,
		MaxLat: maxLat,
	}
}

func LatLonToTilePixel(lat, lon float64, z, x, y int) (int, int) {
	n := math.Pow(2, float64(z))
	worldX := (lon + 180.0) / 360.0 * n * float64(TileSize)
	latRad := lat * math.Pi / 180.0
	worldY := (1.0 - math.Log(math.Tan(latRad)+1.0/math.Cos(latRad))/math.Pi) / 2.0 * n * float64(TileSize)
	tileOriginX := float64(x) * float64(TileSize)
	tileOriginY := float64(y) * float64(TileSize)
	return int(math.Round(worldX - tileOriginX)), int(math.Round(worldY - tileOriginY))
}

func GenerateRasterTile(ctx context.Context, db *gorm.DB, z, x, y int, style string) ([]byte, string, error) {
	cfg := GetStyleConfig(style)

	img := image.NewNRGBA(image.Rect(0, 0, TileSize, TileSize))
	draw.Draw(img, img.Bounds(), &image.Uniform{cfg.BackgroundColor}, image.Point{}, draw.Src)

	geometries, err := queryTileGeometries(ctx, db, z, x, y)
	if err != nil {
		return nil, "", fmt.Errorf("query tile geometries: %w", err)
	}

	if len(geometries) == 0 {
		buf := &bytes.Buffer{}
		if err := png.Encode(buf, img); err != nil {
			return nil, "", fmt.Errorf("encode blank tile: %w", err)
		}
		return buf.Bytes(), "image/png", nil
	}

	drawGeometries(img, geometries, cfg, z, x, y)

	buf := &bytes.Buffer{}
	if err := png.Encode(buf, img); err != nil {
		return nil, "", fmt.Errorf("encode tile: %w", err)
	}

	return buf.Bytes(), "image/png", nil
}

type tileGeometry struct {
	GeoJSON string
}

func queryTileGeometries(ctx context.Context, db *gorm.DB, z, x, y int) ([]tileGeometry, error) {
	bounds := TileToBBox(z, x, y)
	simplificationTolerance := tileSimplificationTolerance(z)

	var geojsonStrings []string
	rows, err := db.WithContext(ctx).Raw(`
		SELECT ST_AsGeoJSON(
			ST_SimplifyPreserveTopology(
				ST_Transform(geometry::geometry, 4326),
				?
			)
		) AS geojson
		FROM project_geometries
		WHERE ST_Intersects(
			ST_Transform(geometry::geometry, 4326),
			ST_MakeEnvelope(?, ?, ?, ?, 4326)
		)
	`, simplificationTolerance, bounds.MinLon, bounds.MinLat, bounds.MaxLon, bounds.MaxLat).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var g string
		if err := rows.Scan(&g); err != nil {
			return nil, err
		}
		geojsonStrings = append(geojsonStrings, g)
	}

	out := make([]tileGeometry, len(geojsonStrings))
	for i, g := range geojsonStrings {
		out[i] = tileGeometry{GeoJSON: g}
	}
	return out, nil
}

func tileSimplificationTolerance(z int) float64 {
	switch {
	case z <= 8:
		return 0.01
	case z <= 10:
		return 0.005
	case z <= 12:
		return 0.001
	case z <= 14:
		return 0.0005
	case z <= 16:
		return 0.0001
	default:
		return 0.00005
	}
}

func drawGeometries(img *image.NRGBA, geometries []tileGeometry, cfg StyleConfig, z, x, y int) {
	for _, g := range geometries {
		var geom GeometryJSON
		if err := json.Unmarshal([]byte(g.GeoJSON), &geom); err != nil {
			continue
		}
		switch geom.Type {
		case "Polygon":
			drawPolygon(img, geom.Coordinates, cfg, z, x, y)
		case "MultiPolygon":
			drawMultiPolygon(img, geom.Coordinates, cfg, z, x, y)
		case "Point":
			drawPoint(img, geom.Coordinates, cfg, z, x, y)
		case "MultiPoint":
			drawMultiPoint(img, geom.Coordinates, cfg, z, x, y)
		case "LineString":
			drawLineString(img, geom.Coordinates, cfg, z, x, y)
		case "MultiLineString":
			drawMultiLineString(img, geom.Coordinates, cfg, z, x, y)
		}
	}
}

func drawMultiPolygon(img *image.NRGBA, coords json.RawMessage, cfg StyleConfig, z, x, y int) {
	var polygons [][][][]float64
	if err := json.Unmarshal(coords, &polygons); err != nil {
		return
	}
	for _, polygon := range polygons {
		rawCoords, _ := json.Marshal(polygon)
		drawPolygon(img, rawCoords, cfg, z, x, y)
	}
}

func drawPolygon(img *image.NRGBA, coords json.RawMessage, cfg StyleConfig, z, x, y int) {
	var rings [][][]float64
	if err := json.Unmarshal(coords, &rings); err != nil || len(rings) == 0 {
		return
	}

	outerRing := rings[0]
	if len(outerRing) < 3 {
		return
	}

	pixels := make([]image.Point, len(outerRing))
	for i, pt := range outerRing {
		if len(pt) < 2 {
			return
		}
		px, py := LatLonToTilePixel(pt[1], pt[0], z, x, y)
		pixels[i] = image.Point{X: px, Y: py}
	}

	if len(pixels) < 3 {
		return
	}

	fillColor := applyOpacity(cfg.FillColor, cfg.FillOpacity)
	fillPolygon(img, pixels, fillColor)

	drawPolygonOutline(img, pixels, cfg.StrokeColor, cfg.StrokeWidth)

	for _, ring := range rings[1:] {
		if len(ring) < 3 {
			continue
		}
		holePixels := make([]image.Point, len(ring))
		for i, pt := range ring {
			if len(pt) < 2 {
				continue
			}
			px, py := LatLonToTilePixel(pt[1], pt[0], z, x, y)
			holePixels[i] = image.Point{X: px, Y: py}
		}
		if len(holePixels) >= 3 {
			fillPolygon(img, holePixels, cfg.BackgroundColor)
			drawPolygonOutline(img, holePixels, cfg.StrokeColor, cfg.StrokeWidth)
		}
	}
}

func drawPoint(img *image.NRGBA, coords json.RawMessage, cfg StyleConfig, z, x, y int) {
	var pt []float64
	if err := json.Unmarshal(coords, &pt); err != nil || len(pt) < 2 {
		return
	}
	px, py := LatLonToTilePixel(pt[1], pt[0], z, x, y)
	if px >= 0 && px < TileSize && py >= 0 && py < TileSize {
		drawDot(img, px, py, 4, cfg.FillColor)
	}
}

func drawMultiPoint(img *image.NRGBA, coords json.RawMessage, cfg StyleConfig, z, x, y int) {
	var points [][]float64
	if err := json.Unmarshal(coords, &points); err != nil {
		return
	}
	for _, pt := range points {
		if len(pt) < 2 {
			continue
		}
		px, py := LatLonToTilePixel(pt[1], pt[0], z, x, y)
		if px >= 0 && px < TileSize && py >= 0 && py < TileSize {
			drawDot(img, px, py, 4, cfg.FillColor)
		}
	}
}

func drawLineString(img *image.NRGBA, coords json.RawMessage, cfg StyleConfig, z, x, y int) {
	var points [][]float64
	if err := json.Unmarshal(coords, &points); err != nil || len(points) < 2 {
		return
	}

	pixels := make([]image.Point, len(points))
	for i, pt := range points {
		if len(pt) < 2 {
			return
		}
		px, py := LatLonToTilePixel(pt[1], pt[0], z, x, y)
		pixels[i] = image.Point{X: px, Y: py}
	}

	drawPolyline(img, pixels, cfg.StrokeColor, cfg.StrokeWidth)
}

func drawMultiLineString(img *image.NRGBA, coords json.RawMessage, cfg StyleConfig, z, x, y int) {
	var lines [][][]float64
	if err := json.Unmarshal(coords, &lines); err != nil {
		return
	}
	for _, line := range lines {
		rawCoords, _ := json.Marshal(line)
		drawLineString(img, rawCoords, cfg, z, x, y)
	}
}

func drawDot(img *image.NRGBA, cx, cy, radius int, c color.NRGBA) {
	for dy := -radius; dy <= radius; dy++ {
		for dx := -radius; dx <= radius; dx++ {
			if dx*dx+dy*dy <= radius*radius {
				x, y := cx+dx, cy+dy
				if x >= 0 && x < TileSize && y >= 0 && y < TileSize {
					img.SetNRGBA(x, y, c)
				}
			}
		}
	}
}

func drawPolyline(img *image.NRGBA, points []image.Point, c color.NRGBA, width int) {
	for i := 0; i < len(points)-1; i++ {
		drawLine(img, points[i], points[i+1], c, width)
	}
}

func drawLine(img *image.NRGBA, p1, p2 image.Point, c color.NRGBA, width int) {
	dx := p2.X - p1.X
	dy := p2.Y - p1.Y
	steps := int(math.Max(math.Abs(float64(dx)), math.Abs(float64(dy))))
	if steps == 0 {
		setPixelSafe(img, p1.X, p1.Y, width, c)
		return
	}

	xIncr := float64(dx) / float64(steps)
	yIncr := float64(dy) / float64(steps)

	x, y := float64(p1.X), float64(p1.Y)
	for i := 0; i <= steps; i++ {
		setPixelSafe(img, int(math.Round(x)), int(math.Round(y)), width, c)
		x += xIncr
		y += yIncr
	}
}

func setPixelSafe(img *image.NRGBA, x, y, width int, c color.NRGBA) {
	half := width / 2
	for dy := -half; dy <= half; dy++ {
		for dx := -half; dx <= half; dx++ {
			px, py := x+dx, y+dy
			if px >= 0 && px < TileSize && py >= 0 && py < TileSize {
				img.SetNRGBA(px, py, c)
			}
		}
	}
}

func drawPolygonOutline(img *image.NRGBA, pixels []image.Point, c color.NRGBA, width int) {
	for i := 0; i < len(pixels)-1; i++ {
		drawLine(img, pixels[i], pixels[i+1], c, width)
	}
	if len(pixels) > 2 {
		drawLine(img, pixels[len(pixels)-1], pixels[0], c, width)
	}
}

func fillPolygon(img *image.NRGBA, pixels []image.Point, c color.NRGBA) {
	minY, maxY := pixels[0].Y, pixels[0].Y
	for _, p := range pixels {
		if p.Y < minY {
			minY = p.Y
		}
		if p.Y > maxY {
			maxY = p.Y
		}
	}
	if minY < 0 {
		minY = 0
	}
	if maxY >= TileSize {
		maxY = TileSize - 1
	}

	for y := minY; y <= maxY; y++ {
		intersections := make([]int, 0)
		for i := 0; i < len(pixels); i++ {
			j := (i + 1) % len(pixels)
			pi, pj := pixels[i], pixels[j]
			if (pi.Y <= y && pj.Y > y) || (pj.Y <= y && pi.Y > y) {
				x := pi.X + (y-pi.Y)*(pj.X-pi.X)/(pj.Y-pi.Y)
				intersections = append(intersections, x)
			}
		}

		for i := 0; i < len(intersections); i++ {
			for j := i + 1; j < len(intersections); j++ {
				if intersections[i] > intersections[j] {
					intersections[i], intersections[j] = intersections[j], intersections[i]
				}
			}
		}

		for i := 0; i < len(intersections)-1; i += 2 {
			x1 := intersections[i]
			x2 := intersections[i+1]
			if x1 < 0 {
				x1 = 0
			}
			if x2 >= TileSize {
				x2 = TileSize - 1
			}
			for x := x1; x <= x2; x++ {
				img.SetNRGBA(x, y, c)
			}
		}
	}
}

func applyOpacity(c color.NRGBA, opacity float64) color.NRGBA {
	if opacity < 0 {
		opacity = 0
	}
	if opacity > 1 {
		opacity = 1
	}
	return color.NRGBA{
		R: c.R,
		G: c.G,
		B: c.B,
		A: uint8(float64(c.A) * opacity),
	}
}

func GenerateMVTTile(ctx context.Context, db *gorm.DB, z, x, y int) ([]byte, string, error) {
	bounds := TileToBBox(z, x, y)
	simplification := tileSimplificationTolerance(z)

	var mvtData []byte
	err := db.WithContext(ctx).Raw(`
		SELECT ST_AsMVT(tile, 'projects', 256, 'geom') AS mvt
		FROM (
			SELECT
				pg.project_id::text AS id,
				ST_AsMVTGeom(
					ST_SimplifyPreserveTopology(
						ST_Transform(pg.geometry::geometry, 3857),
						?
					),
					ST_MakeEnvelope(?, ?, ?, ?, 3857),
					256, 0, true
				) AS geom,
				pg.area_hectares,
				pg.perimeter_meters,
				pg.is_valid,
				pg.source_type,
				pg.version
			FROM project_geometries pg
			WHERE ST_Intersects(
				pg.geometry::geometry,
				ST_Transform(
					ST_MakeEnvelope(?, ?, ?, ?, 4326),
					4326
				)
			)
		) AS tile
	`,
		simplification,
		bounds.MinLon, bounds.MinLat, bounds.MaxLon, bounds.MaxLat,
		bounds.MinLon, bounds.MinLat, bounds.MaxLon, bounds.MaxLat,
	).Scan(&mvtData).Error

	if err != nil {
		return nil, "", fmt.Errorf("generate mvt tile: %w", err)
	}

	if mvtData == nil || len(mvtData) == 0 {
		return []byte{}, "application/x-protobuf", nil
	}

	return mvtData, "application/x-protobuf; name=mapbox-vector-tile", nil
}

func GenerateTile(ctx context.Context, db *gorm.DB, z, x, y int, style, format string) ([]byte, string, error) {
	cacheKey := TileKeyWithFormat(z, x, y, style, format)

	if data, ct, ok := DefaultTileCache.Get(cacheKey); ok {
		return data, ct, nil
	}

	var (
		data        []byte
		contentType string
		err         error
	)

	switch strings.ToLower(format) {
	case FormatMVT:
		data, contentType, err = GenerateMVTTile(ctx, db, z, x, y)
	default:
		data, contentType, err = GenerateRasterTile(ctx, db, z, x, y, style)
	}

	if err != nil {
		return nil, "", err
	}

	DefaultTileCache.Set(cacheKey, data, contentType)

	return data, contentType, nil
}
