package sales

type MilestonePayment struct {
	Name    string  `json:"name"`
	Percent float64 `json:"percent"`
}

func DefaultSchedule(depositPercent float64) []MilestonePayment {
	remaining := 100 - depositPercent
	if remaining < 0 {
		remaining = 0
	}
	return []MilestonePayment{
		{Name: "deposit", Percent: depositPercent},
		{Name: "delivery", Percent: remaining},
	}
}
