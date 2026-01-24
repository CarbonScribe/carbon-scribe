package auth

import (
	"errors"
)

type AuthService struct {
	users map[string]string // map[email]password
}

func NewAuthService() *AuthService {
	return &AuthService{users: make(map[string]string)}
}

func (s *AuthService) Register(email, password string) error {
	if _, exists := s.users[email]; exists {
		return errors.New("user already exists")
	}
	s.users[email] = password
	return nil
}

func (s *AuthService) Login(email, password string) error {
	pass, exists := s.users[email]
	if !exists {
		return errors.New("user not found")
	}
	if pass != password {
		return errors.New("invalid password")
	}
	return nil
}
