package validation

import (
	"fmt"
	"net/mail"
	"net/url"
	"regexp"
	"strings"
)

var phoneRe = regexp.MustCompile(`^[0-9+()\-\s]{7,20}$`)

func ValidateOptionalEmail(email string) error {
	if strings.TrimSpace(email) == "" {
		return nil
	}
	_, err := mail.ParseAddress(email)
	if err != nil {
		return fmt.Errorf("invalid email format")
	}
	return nil
}

func ValidateOptionalPhone(phone string) error {
	if strings.TrimSpace(phone) == "" {
		return nil
	}
	if !phoneRe.MatchString(phone) {
		return fmt.Errorf("invalid phone number format")
	}
	return nil
}

func ValidateOptionalURL(raw string) error {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	u, err := url.ParseRequestURI(raw)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return fmt.Errorf("invalid URL")
	}
	return nil
}

func ValidateOptionalAddress(address map[string]interface{}) error {
	if address == nil {
		return nil
	}
	required := []string{"street", "city", "country"}
	for _, key := range required {
		val, ok := address[key]
		if !ok {
			return fmt.Errorf("address.%s is required", key)
		}
		s, ok := val.(string)
		if !ok || strings.TrimSpace(s) == "" {
			return fmt.Errorf("address.%s must be a non-empty string", key)
		}
	}
	return nil
}
