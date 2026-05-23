// Package seed provides idempotent database seeding for local development.
// Running SeedDevUsers on every startup is safe — it skips accounts that
// already exist and never overwrites existing data.
package seed

import (
	"log"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/auth"
	"carbon-scribe/project-portal/project-portal-backend/pkg/utils"

	"gorm.io/gorm"
)

// devUser describes a default seed account for local development.
type devUser struct {
	Email        string
	Password     string
	FullName     string
	Organization string
	Role         string
}

// defaultDevUsers is the canonical set of local contributor accounts.
// These credentials are intentionally predictable for local development only.
// Never use SEED_DEV_USERS=true in a production environment.
var defaultDevUsers = []devUser{
	{
		Email:        "admin@carbonscribe.dev",
		Password:     "Admin@CarbonScribe2024!",
		FullName:     "Admin User",
		Organization: "CarbonScribe",
		Role:         "admin",
	},
	{
		Email:        "farmer@carbonscribe.dev",
		Password:     "Farmer@CarbonScribe2024!",
		FullName:     "Farmer User",
		Organization: "Green Farms Co.",
		Role:         "farmer",
	},
	{
		Email:        "verifier@carbonscribe.dev",
		Password:     "Verifier@CarbonScribe2024!",
		FullName:     "Verifier User",
		Organization: "CarbonVerify Inc.",
		Role:         "verifier",
	},
	{
		Email:        "viewer@carbonscribe.dev",
		Password:     "Viewer@CarbonScribe2024!",
		FullName:     "Viewer User",
		Organization: "CarbonScribe",
		Role:         "viewer",
	},
}

// SeedDevUsers idempotently inserts the default development accounts.
// It is safe to call on every app start — existing accounts are skipped
// without error or modification. Email verification is pre-confirmed so
// contributors can log in immediately without an email flow.
func SeedDevUsers(db *gorm.DB, passwordHashCost int) {
	log.Println("🌱 Dev seed: checking default contributor accounts...")

	created := 0
	for _, u := range defaultDevUsers {
		var count int64
		if err := db.Model(&auth.User{}).Where("email = ?", u.Email).Count(&count).Error; err != nil {
			log.Printf("⚠️  Dev seed: could not check existence of %s: %v", u.Email, err)
			continue
		}
		if count > 0 {
			continue // already exists — idempotent, nothing to do
		}

		hash, err := utils.HashPassword(u.Password, passwordHashCost)
		if err != nil {
			log.Printf("⚠️  Dev seed: failed to hash password for %s: %v", u.Email, err)
			continue
		}

		now := time.Now()
		user := &auth.User{
			Email:         u.Email,
			PasswordHash:  hash,
			FullName:      u.FullName,
			Organization:  u.Organization,
			Role:          u.Role,
			EmailVerified: true, // pre-verified so login works immediately
			IsActive:      true,
			LastLoginAt:   &now,
		}
		if err := db.Omit("wallet_address").Create(user).Error; err != nil {
			log.Printf("⚠️  Dev seed: failed to create user %s: %v", u.Email, err)
			continue
		}
		log.Printf("   ✅ %s (%s)", u.Email, u.Role)
		created++
	}

	switch created {
	case 0:
		log.Println("🌱 Dev seed: all contributor accounts already present")
	default:
		log.Printf("🌱 Dev seed: created %d contributor account(s)", created)
	}
}
