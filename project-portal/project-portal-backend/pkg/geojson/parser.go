package geojson

import "encoding/json"

func Parse(raw []byte) (map[string]interface{}, error) {
	var out map[string]interface{}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}
