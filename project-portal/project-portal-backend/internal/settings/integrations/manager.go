package integrations

func TemplateList() []map[string]string {
	return []map[string]string{
		{"integration_type": "stripe", "template": "payments"},
		{"integration_type": "stellar_wallet", "template": "wallet"},
		{"integration_type": "weather_service", "template": "weather"},
	}
}
