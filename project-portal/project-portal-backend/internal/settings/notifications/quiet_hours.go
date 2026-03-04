package notifications

import "fmt"

func ValidateQuietHours(start, end string) error {
	if start == "" || end == "" {
		return nil
	}
	if len(start) < 5 || len(end) < 5 {
		return fmt.Errorf("invalid quiet hours format")
	}
	return nil
}
