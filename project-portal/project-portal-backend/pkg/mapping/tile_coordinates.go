package mapping

import "math"

func LonLatToTile(lon, lat float64, zoom int) (int, int) {
	n := math.Pow(2, float64(zoom))
	x := int((lon + 180.0) / 360.0 * n)
	latRad := lat * math.Pi / 180
	y := int((1-math.Log(math.Tan(latRad)+1/math.Cos(latRad))/math.Pi)/2*n)
	return x, y
}
