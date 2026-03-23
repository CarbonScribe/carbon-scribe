package templates

import (
	"fmt"
	"strings"
)

// Render substitutes variables in a template string
func Render(tmpl string, data map[string]interface{}) string {
	res := tmpl
	for k, v := range data {
		placeholder := fmt.Sprintf("{{%s}}", k)
		res = strings.ReplaceAll(res, placeholder, fmt.Sprintf("%v", v))
	}
	return res
}
