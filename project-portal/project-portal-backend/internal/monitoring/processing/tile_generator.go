package processing

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/png"
)

// GeneratePNGTile converts NDVIResult into a PNG raster tile
func GeneratePNGTile(ndvi NDVIResult, reqWidth, reqHeight int) ([]byte, error) {
	width := ndvi.Width
	height := ndvi.Height
	if width <= 0 || height <= 0 {
		width = reqWidth
		height = reqHeight
	}

	img := image.NewRGBA(image.Rect(0, 0, width, height))

	if len(ndvi.Pixels) == 0 {
		// Return transparent tile
		var buf bytes.Buffer
		err := png.Encode(&buf, img)
		return buf.Bytes(), err
	}

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			idx := y*width + x
			if idx < len(ndvi.Pixels) {
				val := ndvi.Pixels[idx]
				img.Set(x, y, ndviColorMap(val))
			} else {
				img.Set(x, y, color.Transparent)
			}
		}
	}

	var buf bytes.Buffer
	err := png.Encode(&buf, img)
	return buf.Bytes(), err
}

// GenerateMVTTile generates a basic JSON vector representation (MVT fallback)
func GenerateMVTTile(ndvi NDVIResult) ([]byte, error) {
	val := 0.0
	if ndvi.Mean != 0 {
		val = ndvi.Mean
	}
	// Basic GeoJSON-like structure for the tile as a fallback vector tile.
	jsonStr := fmt.Sprintf(`{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"ndvi_mean":%f,"ndvi_min":%f,"ndvi_max":%f},"geometry":{"type":"Polygon","coordinates":[[[0,0],[0,256],[256,256],[256,0],[0,0]]]}}]}`, val, ndvi.Min, ndvi.Max)
	return []byte(jsonStr), nil
}

// ndviColorMap maps NDVI values (-1.0 to 1.0) to colors
func ndviColorMap(val float64) color.Color {
	if val < -1.0 {
		val = -1.0
	}
	if val > 1.0 {
		val = 1.0
	}

	if val < 0.0 {
		// Water, snow, clouds: Blue to White
		intensity := uint8((val + 1.0) * 255)
		return color.RGBA{intensity, intensity, 255, 255}
	} else if val < 0.2 {
		// Bare soil: Brown/Grey
		return color.RGBA{139, 69, 19, 255}
	} else if val < 0.5 {
		// Sparse vegetation: Light Green
		return color.RGBA{144, 238, 144, 255}
	}
	// Dense vegetation: Dark Green
	scale := (val - 0.5) * 2.0
	green := uint8(255 - (scale * 155)) // 255 to 100
	return color.RGBA{0, green, 0, 255}
}
