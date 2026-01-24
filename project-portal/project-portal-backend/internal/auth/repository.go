package auth

import "database/sql"

type Repository struct {
	DB *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{DB: db}
}

func (r *Repository) CreateUser(user *User) error {
	query := `
		INSERT INTO users (email, password_hash, full_name, role)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at
	`
	return r.DB.QueryRow(
		query,
		user.Email,
		user.PasswordHash,
		user.FullName,
		user.Role,
	).Scan(&user.ID, &user.CreatedAt)
}

func (r *Repository) GetUserByEmail(email string) (*User, error) {
	user := &User{}
	query := `
		SELECT id, email, password_hash, full_name, role, email_verified, is_active, created_at
		FROM users WHERE email = $1
	`
	err := r.DB.QueryRow(query, email).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.FullName,
		&user.Role,
		&user.EmailVerified,
		&user.IsActive,
		&user.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return user, nil
}
