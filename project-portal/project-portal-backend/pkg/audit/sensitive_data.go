package audit

// SensitiveDataClassifier identifies sensitive data categories and fields.
type SensitiveDataClassifier struct {
	sensitiveFields    map[string]string
	sensitiveEndpoints map[string]string
}

// NewSensitiveDataClassifier creates a classifier with default rules.
func NewSensitiveDataClassifier() *SensitiveDataClassifier {
	return &SensitiveDataClassifier{
		sensitiveFields: map[string]string{
			"password":       "highly_sensitive",
			"ssn":            "highly_sensitive",
			"credit_card":    "highly_sensitive",
			"bank_account":   "highly_sensitive",
			"email":          "sensitive",
			"phone":          "sensitive",
			"address":        "sensitive",
			"date_of_birth":  "sensitive",
			"ip_address":     "sensitive",
		},
		sensitiveEndpoints: map[string]string{
			"/api/v1/compliance/":  "sensitive",
			"/api/auth/":          "sensitive",
			"/api/v1/users/":      "sensitive",
		},
	}
}

// ClassifyField returns the sensitivity level for a given field name.
func (sdc *SensitiveDataClassifier) ClassifyField(fieldName string) string {
	if level, ok := sdc.sensitiveFields[fieldName]; ok {
		return level
	}
	return "normal"
}

// ClassifyEndpoint returns the sensitivity level for a given API endpoint.
func (sdc *SensitiveDataClassifier) ClassifyEndpoint(endpoint string) string {
	for pattern, level := range sdc.sensitiveEndpoints {
		if len(endpoint) >= len(pattern) && endpoint[:len(pattern)] == pattern {
			return level
		}
	}
	return "normal"
}

// IsSensitiveField checks whether a field is classified as sensitive or higher.
func (sdc *SensitiveDataClassifier) IsSensitiveField(fieldName string) bool {
	level := sdc.ClassifyField(fieldName)
	return level == "sensitive" || level == "highly_sensitive"
}
