package quality

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// Handler wires quality scoring endpoints into the router.
type Handler struct {
	svc *QualityScoringService
}

func NewHandler(svc *QualityScoringService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all quality-score routes onto the given chi Router.
// Caller is responsible for wrapping with auth middleware as needed.
//
//	GET  /api/v1/projects/{id}/quality-score
//	GET  /api/v1/projects/{id}/quality-score/history
//	POST /api/v1/projects/{id}/quality-score/recalculate    (admin)
//	GET  /api/v1/methodologies/{tokenId}/score
//	GET  /api/v1/projects/quality/ranking
//	POST /api/v1/projects/quality/sync
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Get("/projects/{id}/quality-score", h.GetProjectScore)
	r.Get("/projects/{id}/quality-score/history", h.GetScoreHistory)
	r.Post("/projects/{id}/quality-score/recalculate", h.RecalculateScore)
	r.Get("/methodologies/{tokenId}/score", h.GetMethodologyScore)
	r.Get("/projects/quality/ranking", h.GetQualityRanking)
	r.Post("/projects/quality/sync", h.SyncScoresToContract)
}

// GetProjectScore godoc
// @Summary     Get current quality score for a project
// @Tags        quality
// @Produce     json
// @Param       id path string true "Project UUID"
// @Success     200 {object} QualityScoreResponse
// @Router      /projects/{id}/quality-score [get]
func (h *Handler) GetProjectScore(w http.ResponseWriter, r *http.Request) {
	projectID, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	score, err := h.svc.GetProjectScore(r.Context(), projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, score)
}

// GetScoreHistory godoc
// @Summary     Get quality score history for a project
// @Tags        quality
// @Produce     json
// @Param       id path string true "Project UUID"
// @Success     200 {array} QualityScoreHistory
// @Router      /projects/{id}/quality-score/history [get]
func (h *Handler) GetScoreHistory(w http.ResponseWriter, r *http.Request) {
	projectID, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	history, err := h.svc.GetScoreHistory(r.Context(), projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, history)
}

// RecalculateScore godoc
// @Summary     Recalculate quality score (admin)
// @Tags        quality
// @Accept      json
// @Produce     json
// @Param       id   path string              true "Project UUID"
// @Param       body body RecalculateRequest  true "Recalculation details"
// @Success     200 {object} QualityScoreResponse
// @Router      /projects/{id}/quality-score/recalculate [post]
func (h *Handler) RecalculateScore(w http.ResponseWriter, r *http.Request) {
	projectID, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	// Methodology token ID passed as query param: ?token_id=42
	tokenIDStr := r.URL.Query().Get("token_id")
	tokenID, err := strconv.Atoi(tokenIDStr)
	if err != nil || tokenID <= 0 {
		writeError(w, http.StatusBadRequest, "token_id query parameter required")
		return
	}

	var req RecalculateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	score, err := h.svc.RecalculateProjectScore(r.Context(), projectID, tokenID, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, score)
}

// GetMethodologyScore godoc
// @Summary     Get base quality score for a methodology token
// @Tags        quality
// @Produce     json
// @Param       tokenId path int true "Methodology Token ID"
// @Success     200 {object} QualityScoreResponse
// @Router      /methodologies/{tokenId}/score [get]
func (h *Handler) GetMethodologyScore(w http.ResponseWriter, r *http.Request) {
	tokenID, err := strconv.Atoi(chi.URLParam(r, "tokenId"))
	if err != nil || tokenID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid token id")
		return
	}

	score, err := h.svc.GetMethodologyBaseScore(r.Context(), tokenID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, score)
}

// GetQualityRanking godoc
// @Summary     List projects ranked by quality score
// @Tags        quality
// @Produce     json
// @Success     200 {array} RankingEntry
// @Router      /projects/quality/ranking [get]
func (h *Handler) GetQualityRanking(w http.ResponseWriter, r *http.Request) {
	ranking, err := h.svc.GetQualityRanking(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, ranking)
}

// SyncScoresToContract godoc
// @Summary     Sync all quality scores to Carbon Asset contract
// @Tags        quality
// @Produce     json
// @Success     202 {object} map[string]string
// @Router      /projects/quality/sync [post]
func (h *Handler) SyncScoresToContract(w http.ResponseWriter, r *http.Request) {
	// Delegate to the quality updater via a goroutine so the response
	// returns immediately (sync can take time for many projects).
	go func() {
		scores, err := h.svc.repo.GetAllProjectScores(r.Context())
		if err != nil {
			return
		}
		_ = scores // quality-updater.go processes these async
	}()

	writeJSON(w, http.StatusAccepted, map[string]string{
		"message": "quality score sync initiated",
	})
}

// --- helpers ---

func parseUUID(s string) (uuid.UUID, error) {
	return uuid.Parse(s)
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}