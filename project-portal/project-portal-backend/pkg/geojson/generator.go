package geojson

import "encoding/json"

func Marshal(v any) ([]byte, error) {
	return json.Marshal(v)
}
