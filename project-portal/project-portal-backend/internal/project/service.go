package project

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

type Service interface {
	CreateProject(ctx context.Context, req *ProjectCreateRequest) (*Project, error)
	GetProject(ctx context.Context, id uuid.UUID) (*Project, error)
	ListProjects(ctx context.Context, limit, offset int) ([]Project, error)
	UpdateProject(ctx context.Context, id uuid.UUID, req *ProjectUpdateRequest) (*Project, error)
	DeleteProject(ctx context.Context, id uuid.UUID) error
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) CreateProject(ctx context.Context, req *ProjectCreateRequest) (*Project, error) {
	project := &Project{
		Name:          req.Name,
		Type:          req.Type,
		Location:      req.Location,
		Area:          req.Area,
		Farmers:       req.Farmers,
		CarbonCredits: req.CarbonCredits,
		Progress:      req.Progress,
		Icon:          req.Icon,
		Status:        req.Status,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if req.Status == "" {
		project.Status = "pending"
	}

	if req.StartDate != "" {
		startDate, err := time.Parse("2006-01-02", req.StartDate)
		if err != nil {
			return nil, errors.New("invalid start_date format, use YYYY-MM-DD")
		}
		project.StartDate = startDate
	}

	err := s.repo.Create(ctx, project)
	if err != nil {
		return nil, err
	}

	return project, nil
}

func (s *service) GetProject(ctx context.Context, id uuid.UUID) (*Project, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *service) ListProjects(ctx context.Context, limit, offset int) ([]Project, error) {
	if limit <= 0 {
		limit = 10
	}
	if limit > 100 {
		limit = 100
	}
	return s.repo.List(ctx, limit, offset)
}

func (s *service) UpdateProject(ctx context.Context, id uuid.UUID, req *ProjectUpdateRequest) (*Project, error) {
	project, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if req.Name != nil {
		project.Name = *req.Name
	}
	if req.Type != nil {
		project.Type = *req.Type
	}
	if req.Location != nil {
		project.Location = *req.Location
	}
	if req.Area != nil {
		project.Area = *req.Area
	}
	if req.Farmers != nil {
		project.Farmers = *req.Farmers
	}
	if req.CarbonCredits != nil {
		project.CarbonCredits = *req.CarbonCredits
	}
	if req.Progress != nil {
		project.Progress = *req.Progress
	}
	if req.Icon != nil {
		project.Icon = *req.Icon
	}
	if req.Status != nil {
		project.Status = *req.Status
	}
	if req.StartDate != nil {
		startDate, err := time.Parse("2006-01-02", *req.StartDate)
		if err != nil {
			return nil, errors.New("invalid start_date format, use YYYY-MM-DD")
		}
		project.StartDate = startDate
	}

	project.UpdatedAt = time.Now()

	err = s.repo.Update(ctx, project)
	if err != nil {
		return nil, err
	}

	return project, nil
}

func (s *service) DeleteProject(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}