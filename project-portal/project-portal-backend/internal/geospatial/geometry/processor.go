package geometry

import "encoding/json"

// ExtractGeometry unwraps GeoJSON Feature objects and returns raw geometry.
func ExtractGeometry(raw json.RawMessage) json.RawMessage {
	var obj map[string]json.RawMessage
	if err := json.Unmarshal(raw, &obj); err != nil {
		return raw
	}

	typeRaw, ok := obj["type"]
	if !ok {
		return raw
	}
	var geoType string
	if err := json.Unmarshal(typeRaw, &geoType); err != nil {
		return raw
	}
	if geoType == "Feature" {
		if g, ok := obj["geometry"]; ok {
			return g
		}
	}
	return raw
}
