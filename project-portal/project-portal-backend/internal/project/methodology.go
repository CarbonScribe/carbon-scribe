package project

// Methodology represents a carbon credit methodology
type Methodology struct {
	ID          string `json:"id" db:"id"`
	Code        string `json:"code" db:"code"`
	Name        string `json:"name" db:"name"`
	Version     string `json:"version" db:"version"`
	Description string `json:"description" db:"description"`
	Category    string `json:"category" db:"category"`
	Status      string `json:"status" db:"status"`
	CreatedAt   string `json:"created_at" db:"created_at"`
	UpdatedAt   string `json:"updated_at" db:"updated_at"`
}

// MethodologyParameter represents a parameter for a methodology
type MethodologyParameter struct {
	ID            string  `json:"id" db:"id"`
	MethodologyID string  `json:"methodology_id" db:"methodology_id"`
	Name          string  `json:"name" db:"name"`
	Type          string  `json:"type" db:"type"`
	Required      bool    `json:"required" db:"required"`
	DefaultValue  *string `json:"default_value,omitempty" db:"default_value"`
	Description   string  `json:"description" db:"description"`
}
