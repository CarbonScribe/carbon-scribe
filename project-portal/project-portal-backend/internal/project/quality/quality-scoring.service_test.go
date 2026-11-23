package quality

import (
	"context"
	"fmt"
	"testing"

	"carbon-scribe/project-portal/project-portal-backend/internal/project/methodology"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func newQualityTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	// Unique shared-cache DSN per test: the service and the repositories must
	// see the same in-memory database across pooled connections.
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())
	// Silent: RecalculateScore intentionally ignores SaveScore/AddScoreHistory
	// errors, and this test does not create those tables. The focus is the
	// injected methodology repository, not persistence.
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	ddl := `CREATE TABLE methodology_registrations (
		id TEXT PRIMARY KEY,
		project_id TEXT NOT NULL,
		methodology_token_id INTEGER NOT NULL,
		contract_id TEXT NOT NULL,
		name TEXT NOT NULL,
		version TEXT,
		registry TEXT,
		registry_link TEXT,
		issuing_authority TEXT,
		owner_address TEXT,
		ip_fsc_id TEXT,
		registered_at DATETIME,
		tx_hash TEXT,
		methodology_verified INTEGER DEFAULT 1
	)`
	require.NoError(t, db.Exec(ddl).Error)
	return db
}

// TestRecalculateScoreDoesNotPanicAndReturnsScore is the regression test for
// #693: RecalculateScore must use an injected methodology repository and
// complete against a real database instead of panicking on a nil *gorm.DB.
func TestRecalculateScoreDoesNotPanicAndReturnsScore(t *testing.T) {
	db := newQualityTestDB(t)
	projectID := uuid.New()
	reg := &methodology.MethodologyRegistration{
		ProjectID:          projectID,
		MethodologyTokenID: 42,
		ContractID:         "CDQXMVTNCAN4KKPFOAMAAKU4B7LNNQI7F6EX2XIGKVNPJPKGWGM35BTP",
		Name:               "Afforestation",
		Version:            "v2.1",
		Registry:           "Verra",
		IssuingAuthority:   "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
		IPFSCID:            "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
	}
	require.NoError(t, db.Create(reg).Error)

	qualityRepo := NewRepository(db)
	methRepo := methodology.NewRepository(db)
	svc := NewService(qualityRepo, methRepo)

	score, err := svc.RecalculateScore(context.Background(), projectID.String(), "admin-1")
	require.NoError(t, err)
	require.NotNil(t, score)

	// Exact values: ignoring the seeded registration would produce a low
	// default score, so these assertions fail if the injected repository is
	// bypassed or its data is not used.
	require.Equal(t, projectID.String(), score.ProjectID)
	require.Equal(t, 42, score.MethodologyTokenID)
	require.Equal(t, 100, score.OverallScore)
	require.Equal(t, map[string]int{
		"registry":      30, // Verra
		"authority":     20, // non-empty issuing authority
		"methodology":   20, // Afforestation
		"version":       15, // v2.x
		"documentation": 15, // IPFS CID present
	}, score.Components)
}

// TestNewServiceRejectsNilMethodologyRepository documents that the methodology
// repository is required: construction fails fast instead of deferring a nil
// dereference to the first RecalculateScore call.
func TestNewServiceRejectsNilMethodologyRepository(t *testing.T) {
	db := newQualityTestDB(t)
	repo := NewRepository(db)

	require.Panics(t, func() {
		NewService(repo, nil)
	})
}
