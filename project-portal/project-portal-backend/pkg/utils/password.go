package utils

import "golang.org/x/crypto/bcrypt"

func HashPassword(password string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hashed), err
}

func CheckPassword(password, hashed string) error {
	return bcrypt.CompareHashAndPassword([]byte(hashed), []byte(password))
}
