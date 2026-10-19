// Test: Foreign Key Constraint Enforcement
// Purpose: Verify that FK constraints properly reject invalid parent IDs
// This test should be run AFTER applying the add_foreign_key_constraints.sql migration
// 
// To run:
//   1. Apply the migration: psql -U <user> -d <db> -f migrations/add_foreign_key_constraints.sql
//   2. Set TEST_DATABASE_URL environment variable
//   3. Run: go test migrations/fk_constraint_test.go -v

package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"testing"

	_ "github.com/lib/pq"
)

func getTestDB() (*sql.DB, error) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("TEST_DATABASE_URL environment variable not set")
	}
	
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}
	
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}
	
	return db, nil
}

func TestFKConstraint_RejectsInvalidProjectID(t *testing.T) {
	db, err := getTestDB()
	if err != nil {
		t.Skipf("Skipping test: %v", err)
	}
	defer db.Close()

	// Clean up any existing test data
	db.Exec("DELETE FROM project_members WHERE user_id = 'test-user-fk'")

	// Try to insert a project_member with a non-existent project_id
	_, err = db.Exec(`
		INSERT INTO project_members (id, project_id, user_id, role, joined_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
	`, "test-member-id", "00000000-0000-0000-0000-000000000000", "test-user-fk", "Viewer")

	if err == nil {
		t.Error("Expected FK constraint violation error, but insert succeeded")
		db.Exec("DELETE FROM project_members WHERE user_id = 'test-user-fk'")
		return
	}

	t.Logf("✓ FK constraint correctly rejected invalid project_id: %v", err)
}

func TestFKConstraint_RejectsInvalidUserID(t *testing.T) {
	db, err := getTestDB()
	if err != nil {
		t.Skipf("Skipping test: %v", err)
	}
	defer db.Close()

	// First, ensure we have a valid project
	var projectID string
	err = db.QueryRow("SELECT id FROM projects LIMIT 1").Scan(&projectID)
	if err != nil {
		t.Skipf("Skipping test: no projects found in database: %v", err)
	}

	// Try to insert a project_member with a non-existent user_id
	_, err = db.Exec(`
		INSERT INTO project_members (id, project_id, user_id, role, joined_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
	`, "test-member-id-2", projectID, "00000000-0000-0000-0000-000000000000", "Viewer")

	if err == nil {
		t.Error("Expected FK constraint violation error, but insert succeeded")
		db.Exec("DELETE FROM project_members WHERE id = 'test-member-id-2'")
		return
	}

	t.Logf("✓ FK constraint correctly rejected invalid user_id: %v", err)
}

func TestFKConstraint_AllowsValidReferences(t *testing.T) {
	db, err := getTestDB()
	if err != nil {
		t.Skipf("Skipping test: %v", err)
	}
	defer db.Close()

	// Get valid project and user IDs
	var projectID, userID string
	err = db.QueryRow("SELECT id FROM projects LIMIT 1").Scan(&projectID)
	if err != nil {
		t.Skipf("Skipping test: no projects found: %v", err)
	}
	
	err = db.QueryRow("SELECT id FROM users LIMIT 1").Scan(&userID)
	if err != nil {
		t.Skipf("Skipping test: no users found: %v", err)
	}

	// Clean up any existing test data
	db.Exec("DELETE FROM project_members WHERE id = 'test-member-valid'")

	// Try to insert with valid references
	_, err = db.Exec(`
		INSERT INTO project_members (id, project_id, user_id, role, joined_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
	`, "test-member-valid", projectID, userID, "Viewer")

	if err != nil {
		t.Errorf("Expected insert to succeed with valid references, but got error: %v", err)
		return
	}

	// Clean up
	db.Exec("DELETE FROM project_members WHERE id = 'test-member-valid'")
	t.Log("✓ FK constraint correctly allowed valid references")
}

func TestFKConstraint_CascadeDelete(t *testing.T) {
	db, err := getTestDB()
	if err != nil {
		t.Skipf("Skipping test: %v", err)
	}
	defer db.Close()

	// Get valid project and user IDs
	var projectID, userID string
	err = db.QueryRow("SELECT id FROM projects LIMIT 1").Scan(&projectID)
	if err != nil {
		t.Skipf("Skipping test: no projects found: %v", err)
	}
	
	err = db.QueryRow("SELECT id FROM users LIMIT 1").Scan(&userID)
	if err != nil {
		t.Skipf("Skipping test: no users found: %v", err)
	}

	// Create a test project (not using existing to avoid affecting real data)
	testProjectID := "test-project-fk-cascade"
	testUserID := "test-user-fk-cascade"
	testMemberID := "test-member-fk-cascade"

	// Clean up any existing test data
	db.Exec("DELETE FROM project_members WHERE id = $1", testMemberID)
	db.Exec("DELETE FROM projects WHERE id = $1", testProjectID)
	db.Exec("DELETE FROM users WHERE id = $1", testUserID)

	// Create test user and project
	db.Exec(`INSERT INTO users (id, email, password_hash, full_name, role) VALUES ($1, $2, $3, $4, $5)`,
		testUserID, "test-fk@example.com", "hash", "Test User", "farmer")
	db.Exec(`INSERT INTO projects (id, name, type, location, area) VALUES ($1, $2, $3, $4, $5)`,
		testProjectID, "Test Project", "Reforestation", "Test Location", 100.0)

	// Create project_member
	_, err = db.Exec(`
		INSERT INTO project_members (id, project_id, user_id, role, joined_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
	`, testMemberID, testProjectID, testUserID, "Viewer")

	if err != nil {
		t.Errorf("Failed to create test project_member: %v", err)
		db.Exec("DELETE FROM projects WHERE id = $1", testProjectID)
		db.Exec("DELETE FROM users WHERE id = $1", testUserID)
		return
	}

	// Delete the project (should cascade delete project_member)
	_, err = db.Exec("DELETE FROM projects WHERE id = $1", testProjectID)
	if err != nil {
		t.Errorf("Failed to delete test project: %v", err)
		db.Exec("DELETE FROM project_members WHERE id = $1", testMemberID)
		db.Exec("DELETE FROM users WHERE id = $1", testUserID)
		return
	}

	// Verify project_member was cascade deleted
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM project_members WHERE id = $1", testMemberID).Scan(&count)
	if err != nil {
		t.Errorf("Failed to check project_member deletion: %v", err)
	} else if count > 0 {
		t.Error("CASCADE DELETE did not remove project_member when project was deleted")
	} else {
		t.Log("✓ CASCADE DELETE correctly removed project_member")
	}

	// Clean up
	db.Exec("DELETE FROM users WHERE id = $1", testUserID)
}

func TestFKConstraint_VerifyAllConstraintsExist(t *testing.T) {
	db, err := getTestDB()
	if err != nil {
		t.Skipf("Skipping test: %v", err)
	}
	defer db.Close()

	// Query to check all FK constraints on collaboration tables
	rows, err := db.Query(`
		SELECT conname, conrelid::regclass AS table_name, confrelid::regclass AS referenced_table 
		FROM pg_constraint 
		WHERE conrelid::regclass::text IN (
			'project_members', 'project_invitations', 'activity_logs', 
			'comments', 'tasks', 'task_dependencies', 'shared_resources', 'resource_bookings'
		)
		AND contype = 'f'
		ORDER BY table_name, conname
	`)
	if err != nil {
		t.Fatalf("Failed to query constraints: %v", err)
	}
	defer rows.Close()

	constraints := []struct {
		name  string
		table string
		ref   string
	}{}

	for rows.Next() {
		var name, table, ref string
		if err := rows.Scan(&name, &table, &ref); err != nil {
			t.Fatalf("Failed to scan constraint: %v", err)
		}
		constraints = append(constraints, struct {
			name  string
			table string
			ref   string
		}{name, table, ref})
		t.Logf("Found constraint: %s on %s -> %s", name, table, ref)
	}

	// Expected 14 constraints
	expectedCount := 14
	if len(constraints) != expectedCount {
		t.Errorf("Expected %d FK constraints, found %d", expectedCount, len(constraints))
	} else {
		t.Logf("✓ All %d expected FK constraints are present", expectedCount)
	}
}

func main() {
	// Run tests
	testing.Main(
		func(pat, str string) (bool, error) { return true, nil },
		[]testing.InternalTest{
			{"TestFKConstraint_RejectsInvalidProjectID", TestFKConstraint_RejectsInvalidProjectID},
			{"TestFKConstraint_RejectsInvalidUserID", TestFKConstraint_RejectsInvalid
