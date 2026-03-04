package profile

import (
	"encoding/json"
)

func ExportJSON(v interface{}) ([]byte, error) {
	return json.MarshalIndent(v, "", "  ")
}

func ExportPDFPlaceholder() []byte {
	return []byte("PDF export generation is not implemented in this build")
}
