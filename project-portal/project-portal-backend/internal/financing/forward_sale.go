package financing

// ForwardSale represents a forward sale agreement for carbon credits
type ForwardSale struct {
	ID              string  `json:"id" db:"id"`
	ProjectID       string  `json:"project_id" db:"project_id"`
	BuyerID         string  `json:"buyer_id" db:"buyer_id"`
	VintageYear     int     `json:"vintage_year" db:"vintage_year"`
	TonsCommitted   float64 `json:"tons_committed" db:"tons_committed"`
	PricePerTon     float64 `json:"price_per_ton" db:"price_per_ton"`
	TotalAmount     float64 `json:"total_amount" db:"total_amount"`
	Currency        string  `json:"currency" db:"currency"`
	Status          string  `json:"status" db:"status"`
	DeliveryDate    string  `json:"delivery_date" db:"delivery_date"`
	DepositPercent  float64 `json:"deposit_percent" db:"deposit_percent"`
	CreatedAt       string  `json:"created_at" db:"created_at"`
	UpdatedAt       string  `json:"updated_at" db:"updated_at"`
}
