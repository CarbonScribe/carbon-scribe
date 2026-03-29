package project

import (
	"context"
	"fmt"

	"carbon-scribe/project-portal/project-portal-backend/internal/financing/tokenization/minting"
	"github.com/google/uuid"
)

// CompleteVerification is called when a project passes its final verification check.
// It updates the project status and triggers the automatic minting of carbon credits.
func CompleteVerification(ctx context.Context, projectID uuid.UUID, verificationID *uuid.UUID, mintService minting.Service) error {
	if mintService == nil {
		return fmt.Errorf("minting service is required for verification completion")
	}

	// Trigger the minting process
	_, err := mintService.MintProjectCredits(ctx, projectID, verificationID)
	if err != nil {
		return fmt.Errorf("failed to trigger minting: %w", err)
	}

	return nil
}
