package geojson

import "encoding/json"

// Normalize returns canonical JSON bytes.
func Normalize(raw []byte) ([]byte, error) {
	var obj interface{}
	if err := json.Unmarshal(raw, &obj); err != nil {
		return nil, err
	}
	return json.Marshal(obj)
}
