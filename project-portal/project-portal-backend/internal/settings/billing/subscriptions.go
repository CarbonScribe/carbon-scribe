package billing

type Plan struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Features []string `json:"features"`
}

func DefaultPlans() []Plan {
	return []Plan{
		{ID: "free", Name: "Free"},
		{ID: "basic", Name: "Basic"},
		{ID: "pro", Name: "Pro"},
		{ID: "enterprise", Name: "Enterprise"},
	}
}

func NextDunningStatus(current string, paymentMethodUpdated bool) string {
	if paymentMethodUpdated && (current == "past_due" || current == "unpaid") {
		return "active"
	}
	switch current {
	case "active":
		return "past_due"
	case "past_due":
		return "unpaid"
	default:
		return current
	}
}
