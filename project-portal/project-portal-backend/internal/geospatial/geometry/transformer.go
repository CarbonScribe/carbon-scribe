package geometry

import "fmt"

func ValidateSRID(srid int) error {
	if srid <= 0 {
		return fmt.Errorf("invalid srid")
	}
	return nil
}
