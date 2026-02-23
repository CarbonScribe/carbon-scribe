package geojson

import (
	"encoding/json"
	"fmt"
)

func ValidateRFC7946(raw []byte) error {
	var obj map[string]interface{}
	if err := json.Unmarshal(raw, &obj); err != nil {
		return fmt.Errorf("invalid json: %w", err)
	}
	if _, ok := obj["type"].(string); !ok {
		return fmt.Errorf("missing type")
	}
	if obj["type"] == "Feature" {
		g, ok := obj["geometry"].(map[string]interface{})
		if !ok {
			return fmt.Errorf("feature geometry is required")
		}
		if _, ok := g["type"].(string); !ok {
			return fmt.Errorf("feature geometry type is required")
		}
	}
	return nil
}
