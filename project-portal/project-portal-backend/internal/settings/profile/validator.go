package profile

import v "carbon-scribe/project-portal/project-portal-backend/pkg/validation"

func ValidateContactInfo(email, phone, website string) error {
	if err := v.ValidateOptionalEmail(email); err != nil {
		return err
	}
	if err := v.ValidateOptionalPhone(phone); err != nil {
		return err
	}
	return v.ValidateOptionalURL(website)
}

func ValidateAddress(address map[string]interface{}) error {
	return v.ValidateOptionalAddress(address)
}
