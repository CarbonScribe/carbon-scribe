package validation

import (
	"encoding/json"
	"net/http"
	"strconv"

	"carbon-scribe/project-portal/project-portal-backend/internal/integration/stellar"
)

type ValidationHandler struct {
	validator *MethodologyValidatorService
}

func NewValidationHandler(client stellar.Methodologies) *ValidationHandler {
	return &ValidationHandler{
		validator: NewMethodologyValidatorService(client),
	}
}

func (h *ValidationHandler) ValidateMethodologyHandler(w http.ResponseWriter, r *http.Request) {
	tokenIDStr := r.PathValue("tokenId")
	tokenID, err := strconv.ParseUint(tokenIDStr, 10, 32)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid token ID"})
		return
	}

	result, err := h.validator.ValidateMethodologyToken(r.Context(), uint32(tokenID))
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
} 