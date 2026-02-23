package maps

import "fmt"

type MapboxClient struct {
	AccessToken string
}

func (c *MapboxClient) StaticMapURL(style string, lon, lat, zoom float64, width, height int) string {
	if style == "" {
		style = "satellite-v9"
	}
	return fmt.Sprintf("https://api.mapbox.com/styles/v1/mapbox/%s/static/%f,%f,%.2f/%dx%d?access_token=%s", style, lon, lat, zoom, width, height, c.AccessToken)
}
