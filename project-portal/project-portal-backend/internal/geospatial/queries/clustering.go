package queries

// ClusterKey returns a lightweight cluster key for map grouping.
func ClusterKey(lat, lon float64, precision float64) (float64, float64) {
	if precision <= 0 {
		precision = 0.1
	}
	return float64(int(lat/precision)) * precision, float64(int(lon/precision)) * precision
}
