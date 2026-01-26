package projects

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"carbon-scribe/project-portal-backend/pkg/geospatial"
	"carbon-scribe/project-portal-backend/pkg/workflows"
)

// Requests

type CreateProjectRequest struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	OwnerID     uuid.UUID `json:"owner_id"`
	Geometry    string  `json:"geometry"` // GeoJSON string
	Area        float64 `json:"area"`
}

type UpdateProjectRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
	Geometry    *string `json:"geometry"`
	Area        *float64 `json:"area"`
}

// Service interface
type ProjectService interface {
	CreateProject(ctx context.Context, req CreateProjectRequest) (*Project, error)
	GetProject(ctx context.Context, id uuid.UUID) (*Project, error)
	UpdateProject(ctx context.Context, id uuid.UUID, req UpdateProjectRequest, userID uuid.UUID) (*Project, error)
	DeleteProject(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
	ListProjects(ctx context.Context, filter ProjectFilter) ([]*Project, error)
}

// Implementation
type projectService struct {
	projectRepo  ProjectRepository
	statusRepo   StatusHistoryRepository
	activityRepo ActivityRepository
	stateMachine *workflows.StateMachine
}

func NewProjectService(
	projectRepo ProjectRepository,
	statusRepo StatusHistoryRepository,
	activityRepo ActivityRepository,
) ProjectService {
	return &projectService{
		projectRepo:  projectRepo,
		statusRepo:   statusRepo,
		activityRepo: activityRepo,
		stateMachine: workflows.NewStateMachine(),
	}
}

func (s *projectService) CreateProject(ctx context.Context, req CreateProjectRequest) (*Project, error) {
	// Validation
	if req.Name == "" {
		return nil, errors.New("name is required")
	}
	if req.OwnerID == uuid.Nil {
		return nil, errors.New("owner_id is required")
	}

	project := &Project{
		Name:        req.Name,
		Description: req.Description,
		Status:      "DRAFT",
		OwnerID:     req.OwnerID,
		Geometry:    nil, // TODO: parse GeoJSON
		Area:        req.Area,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if req.Geometry != "" {
		// Validate GeoJSON
		geom, err := geospatial.ValidateGeoJSON(req.Geometry)
		if err != nil {
			return nil, fmt.Errorf("invalid geometry: %w", err)
		}
		project.Geometry = []byte(req.Geometry)

		// Calculate area if not provided
		if req.Area == 0 {
			areaSqM := geospatial.CalculateArea(geom)
			project.Area = geospatial.ConvertToHectares(areaSqM)
		}
	}

	err := s.projectRepo.Create(ctx, project)
	if err != nil {
		return nil, err
	}

	// Add initial status history
	history := &ProjectStatusHistory{
		ProjectID: project.ID,
		Status:    "DRAFT",
		ChangedAt: time.Now(),
		ChangedBy: req.OwnerID,
	}
	s.statusRepo.Create(ctx, history)

	// Add activity
	activity := &ProjectActivity{
		ProjectID:   project.ID,
		ActivityType: "CREATED",
		Description: fmt.Sprintf("Project %s created", project.Name),
		CreatedAt:   time.Now(),
		UserID:      req.OwnerID,
	}
	s.activityRepo.Create(ctx, activity)

	return project, nil
}

func (s *projectService) GetProject(ctx context.Context, id uuid.UUID) (*Project, error) {
	return s.projectRepo.GetByID(ctx, id)
}

func (s *projectService) UpdateProject(ctx context.Context, id uuid.UUID, req UpdateProjectRequest, userID uuid.UUID) (*Project, error) {
	project, err := s.projectRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Check ownership
	if project.OwnerID != userID {
		return nil, errors.New("unauthorized")
	}

	// Update fields
	if req.Name != nil {
		project.Name = *req.Name
	}
	if req.Description != nil {
		project.Description = *req.Description
	}
	if req.Status != nil {
		// Enforce state machine
		if !s.stateMachine.CanTransition(project.Status, *req.Status) {
			return nil, errors.New("invalid status transition")
		}
		oldStatus := project.Status
		project.Status = *req.Status

		// Add status history
		history := &ProjectStatusHistory{
			ProjectID: id,
			Status:    *req.Status,
			ChangedAt: time.Now(),
			ChangedBy: userID,
		}
		s.statusRepo.Create(ctx, history)

		// Add activity
		activity := &ProjectActivity{
			ProjectID:   id,
			ActivityType: "STATUS_CHANGED",
			Description: fmt.Sprintf("Status changed from %s to %s", oldStatus, *req.Status),
			CreatedAt:   time.Now(),
			UserID:      userID,
		}
		s.activityRepo.Create(ctx, activity)
	}
	if req.Geometry != nil {
		// Validate GeoJSON
		geom, err := geospatial.ValidateGeoJSON(*req.Geometry)
		if err != nil {
			return nil, fmt.Errorf("invalid geometry: %w", err)
		}
		project.Geometry = []byte(*req.Geometry)

		// Recalculate area
		areaSqM := geospatial.CalculateArea(geom)
		project.Area = geospatial.ConvertToHectares(areaSqM)
	}
	if req.Area != nil {
		project.Area = *req.Area
	}

	project.UpdatedAt = time.Now()

	err = s.projectRepo.Update(ctx, project)
	if err != nil {
		return nil, err
	}

	return project, nil
}

func (s *projectService) DeleteProject(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*Project, error) {
	project, err := s.projectRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if project.OwnerID != userID {
		return nil, errors.New("unauthorized")
	}

	err = s.projectRepo.Delete(ctx, id)
	if err != nil {
		return nil, err
	}

	// Add activity
	activity := &ProjectActivity{
		ProjectID:   id,
		ActivityType: "DELETED",
		Description: fmt.Sprintf("Project %s deleted", project.Name),
		CreatedAt:   time.Now(),
		UserID:      userID,
	}
	s.activityRepo.Create(ctx, activity)

	return project, nil
}

func (s *projectService) ListProjects(ctx context.Context, filter ProjectFilter) ([]*Project, error) {
	return s.projectRepo.List(ctx, filter)
}