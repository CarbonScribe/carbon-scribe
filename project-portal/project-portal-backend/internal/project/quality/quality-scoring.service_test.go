package quality

import (
	"context"
	"testing"

	"carbon-scribe/project-portal/project-portal-backend/internal/project/methodology"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newQualityTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
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
	require.GreaterOrEqual(t, score.OverallScore, 0)
	require.LessOrEqual(t, score.OverallScore, 100)
	require.NotEmpty(t, score.Components)
}

func TestNewServiceRejectsNilMethodologyRepository(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file::memory:"), &gorm.Config{})
	require.NoError(t, err)
	repo := NewRepository(db)

	require.Panics(t, func() {
		NewService(repo, nil)
	})
}
