package geofencing

func IsCrossing(previousDistance, currentDistance, threshold float64) bool {
	return previousDistance > threshold && currentDistance <= threshold
}
