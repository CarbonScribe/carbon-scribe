package mapping

func ResolveStyle(style, fallback string) string {
	if style != "" {
		return style
	}
	if fallback != "" {
		return fallback
	}
	return "streets-v12"
}
