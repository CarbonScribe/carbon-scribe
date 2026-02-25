package maps

import "fmt"

type GoogleMapsClient struct {
	APIKey string
}

func (c *GoogleMapsClient) StaticMapURL(lat, lon, zoom float64, width, height int) string {
	return fmt.Sprintf("https://maps.googleapis.com/maps/api/staticmap?center=%f,%f&zoom=%.1f&size=%dx%d&key=%s", lat, lon, zoom, width, height, c.APIKey)
}
