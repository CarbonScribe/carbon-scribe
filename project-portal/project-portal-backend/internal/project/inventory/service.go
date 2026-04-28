package inventory

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Service defines the interface for inventory operations
type Service interface {
	GetInventorySummary(ctx context.Context, projectID uuid.UUID, ownerAddress string) (*InventorySummary, error)
	ListCredits(ctx context.Context, projectID uuid.UUID, ownerAddress string, limit, offset int) (*CreditListResponse, error)
	ListActiveCredits(ctx context.Context, projectID uuid.UUID, ownerAddress string, limit, offset int) (*CreditListResponse, error)
	ListRetiredCredits(ctx context.Context, projectID uuid.UUID, ownerAddress string, limit, offset int) (*CreditListResponse, error)
	GetCreditDetails(ctx context.Context, projectID uuid.UUID, tokenID uint32) (*CreditDetailResponse, error)
	GetCreditMetadata(ctx context.Context, tokenID uint32) (*CreditMetadata, error)
	SyncProjectInventory(ctx context.Context, projectID uuid.UUID, ownerAddress string) error
}

type service struct {
	repo           Repository
	sorobanClient  SorobanClient
	cacheTTL       time.Duration
	syncLocks      map[uuid.UUID]*sync.Mutex
	syncLocksMutex sync.Mutex
}

// NewService creates a new inventory service
func NewService(repo Repository, sorobanClient SorobanClient, cacheTTL time.Duration) Service {
	if cacheTTL == 0 {
		cacheTTL = 5 * time.Minute
	}
	return &service{
		repo:          repo,
		sorobanClient: sorobanClient,
		cacheTTL:      cacheTTL,
		syncLocks:     make(map[uuid.UUID]*sync.Mutex),
	}
}

func (s *service) getSyncLock(projectID uuid.UUID) *sync.Mutex {
	s.syncLocksMutex.Lock()
	defer s.syncLocksMutex.Unlock()

	if lock, ok := s.syncLocks[projectID]; ok {
		return lock
	}
	lock := &sync.Mutex{}
	s.syncLocks[projectID] = lock
	return lock
}

func (s *service) isCacheStale(ctx context.Context, projectID uuid.UUID) bool {
	lastSync, err := s.repo.GetLastSyncTime(ctx, projectID)
	if err != nil {
		return true
	}
	if lastSync.IsZero() {
		return true
	}
	return time.Since(lastSync) > s.cacheTTL
}

func (s *service) ensureFreshCache(ctx context.Context, projectID uuid.UUID, ownerAddress string) error {
	if !s.isCacheStale(ctx, projectID) {
		return nil
	}
	return s.SyncProjectInventory(ctx, projectID, ownerAddress)
}

func (s *service) GetInventorySummary(ctx context.Context, projectID uuid.UUID, ownerAddress string) (*InventorySummary, error) {
	if err := s.ensureFreshCache(ctx, projectID, ownerAddress); err != nil {
		return nil, fmt.Errorf("failed to sync inventory: %w", err)
	}

	return s.repo.GetInventorySummary(ctx, projectID)
}

func (s *service) ListCredits(ctx context.Context, projectID uuid.UUID, ownerAddress string, limit, offset int) (*CreditListResponse, error) {
	if err := s.ensureFreshCache(ctx, projectID, ownerAddress); err != nil {
		return nil, fmt.Errorf("failed to sync inventory: %w", err)
	}

	limit = normalizeLimit(limit)
	caches, total, err := s.repo.ListCreditsByProject(ctx, projectID, limit, offset)
	if err != nil {
		return nil, err
	}

	return s.buildCreditListResponse(caches, total, limit, offset)
}

func (s *service) ListActiveCredits(ctx context.Context, projectID uuid.UUID, ownerAddress string, limit, offset int) (*CreditListResponse, error) {
	if err := s.ensureFreshCache(ctx, projectID, ownerAddress); err != nil {
		return nil, fmt.Errorf("failed to sync inventory: %w", err)
	}

	limit = normalizeLimit(limit)
	caches, total, err := s.repo.ListActiveCredits(ctx, projectID, limit, offset)
	if err != nil {
		return nil, err
	}

	return s.buildCreditListResponse(caches, total, limit, offset)
}

func (s *service) ListRetiredCredits(ctx context.Context, projectID uuid.UUID, ownerAddress string, limit, offset int) (*CreditListResponse, error) {
	if err := s.ensureFreshCache(ctx, projectID, ownerAddress); err != nil {
		return nil, fmt.Errorf("failed to sync inventory: %w", err)
	}

	limit = normalizeLimit(limit)
	caches, total, err := s.repo.ListRetiredCredits(ctx, projectID, limit, offset)
	if err != nil {
		return nil, err
	}

	return s.buildCreditListResponse(caches, total, limit, offset)
}

func (s *service) GetCreditDetails(ctx context.Context, projectID uuid.UUID, tokenID uint32) (*CreditDetailResponse, error) {
	cache, err := s.repo.GetCreditByTokenID(ctx, projectID, tokenID)
	if err != nil {
		status, statusErr := s.sorobanClient.GetStatus(ctx, tokenID)
		if statusErr != nil {
			return nil, fmt.Errorf("credit not found: %w", err)
		}
		return s.fetchCreditFromChain(ctx, tokenID, status)
	}

	return &CreditDetailResponse{
		TokenID:      cache.TokenID,
		Owner:        cache.OwnerAddress,
		Status:       cache.Status,
		QualityScore: cache.QualityScore,
		IsBurned:     cache.IsBurned,
		Metadata: CreditMetadata{
			VintageYear:   cache.VintageYear,
			MethodologyID: cache.MethodologyID,
		},
		LastSynced: cache.LastSynced,
	}, nil
}

func (s *service) GetCreditMetadata(ctx context.Context, tokenID uint32) (*CreditMetadata, error) {
	return s.sorobanClient.GetMetadata(ctx, tokenID)
}

func (s *service) SyncProjectInventory(ctx context.Context, projectID uuid.UUID, ownerAddress string) error {
	lock := s.getSyncLock(projectID)
	lock.Lock()
	defer lock.Unlock()

	if !s.isCacheStale(ctx, projectID) {
		return nil
	}

	tokenIDs, err := s.sorobanClient.TokensOfOwner(ctx, ownerAddress)
	if err != nil {
		return fmt.Errorf("failed to fetch tokens from contract: %w", err)
	}

	caches := make([]ProjectCreditCache, 0, len(tokenIDs))
	for _, tokenID := range tokenIDs {
		cache, err := s.fetchTokenData(ctx, projectID, tokenID, ownerAddress)
		if err != nil {
			continue
		}
		caches = append(caches, *cache)
	}

	if len(caches) > 0 {
		if err := s.repo.BulkUpsertCreditCache(ctx, caches); err != nil {
			return fmt.Errorf("failed to cache credits: %w", err)
		}
	}

	return nil
}

func (s *service) fetchTokenData(ctx context.Context, projectID uuid.UUID, tokenID uint32, ownerAddress string) (*ProjectCreditCache, error) {
	metadata, err := s.sorobanClient.GetMetadata(ctx, tokenID)
	if err != nil {
		return nil, err
	}

	status, err := s.sorobanClient.GetStatus(ctx, tokenID)
	if err != nil {
		return nil, err
	}

	qualityScore, _ := s.sorobanClient.GetQualityScore(ctx, tokenID)
	burned, _ := s.sorobanClient.IsBurned(ctx, tokenID)

	return &ProjectCreditCache{
		ProjectID:     projectID,
		TokenID:       tokenID,
		OwnerAddress:  ownerAddress,
		Status:        status,
		VintageYear:   metadata.VintageYear,
		MethodologyID: metadata.MethodologyID,
		QualityScore:  qualityScore,
		IsBurned:      burned,
	}, nil
}

func (s *service) fetchCreditFromChain(ctx context.Context, tokenID uint32, status AssetStatus) (*CreditDetailResponse, error) {
	metadata, err := s.sorobanClient.GetMetadata(ctx, tokenID)
	if err != nil {
		return nil, err
	}

	qualityScore, _ := s.sorobanClient.GetQualityScore(ctx, tokenID)
	burned, _ := s.sorobanClient.IsBurned(ctx, tokenID)

	return &CreditDetailResponse{
		TokenID:      tokenID,
		Status:       status,
		QualityScore: qualityScore,
		IsBurned:     burned,
		Metadata:     *metadata,
		LastSynced:   time.Now().UTC(),
	}, nil
}

func (s *service) buildCreditListResponse(caches []ProjectCreditCache, total int64, limit, offset int) (*CreditListResponse, error) {
	credits := make([]Credit, len(caches))
	var lastSynced time.Time

	for i, cache := range caches {
		credits[i] = Credit{
			TokenID:      cache.TokenID,
			Owner:        cache.OwnerAddress,
			Status:       cache.Status,
			QualityScore: cache.QualityScore,
			IsBurned:     cache.IsBurned,
			Metadata: CreditMetadata{
				VintageYear:   cache.VintageYear,
				MethodologyID: cache.MethodologyID,
			},
		}
		if cache.LastSynced.After(lastSynced) {
			lastSynced = cache.LastSynced
		}
	}

	return &CreditListResponse{
		Credits:    credits,
		Total:      total,
		Limit:      limit,
		Offset:     offset,
		LastSynced: lastSynced,
	}, nil
}

func normalizeLimit(limit int) int {
	if limit <= 0 {
		return 20
	}
	if limit > 100 {
		return 100
	}
	return limit
}
