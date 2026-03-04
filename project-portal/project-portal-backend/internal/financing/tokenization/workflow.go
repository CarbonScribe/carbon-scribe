package tokenization

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/financing"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Workflow orchestrates the complete token minting process
type Workflow struct {
	db            *gorm.DB
	stellarClient *StellarClient
	config        *WorkflowConfig
}

// WorkflowConfig contains workflow configuration
type WorkflowConfig struct {
	MaxRetries          int           `json:"max_retries"`
	RetryInterval       time.Duration `json:"retry_interval"`
	ConfirmationTimeout time.Duration `json:"confirmation_timeout"`
	BatchSize           int           `json:"batch_size"`
	GasOptimization     bool          `json:"gas_optimization"`
}

// MintWorkflowRequest represents a request to initiate the minting workflow
type MintWorkflowRequest struct {
	CreditID     uuid.UUID              `json:"credit_id"`
	WorkflowType financing.WorkflowType `json:"workflow_type"`
	Priority     int                    `json:"priority"`
	Recipient    string                 `json:"recipient"`
	AssetCode    string                 `json:"asset_code"`
	Metadata     map[string]interface{} `json:"metadata"`
}

// MintWorkflowResponse represents the response from initiating a minting workflow
type MintWorkflowResponse struct {
	WorkflowID    uuid.UUID `json:"workflow_id"`
	Status        string    `json:"status"`
	EstimatedTime int       `json:"estimated_time_seconds"`
	Message       string    `json:"message"`
}

// WorkflowStatus represents the current status of a minting workflow
type WorkflowStatus struct {
	WorkflowID          uuid.UUID      `json:"workflow_id"`
	Status              string         `json:"status"`
	Progress            float64        `json:"progress"`
	CurrentStep         string         `json:"current_step"`
	EstimatedCompletion *time.Time     `json:"estimated_completion"`
	Error               *WorkflowError `json:"error,omitempty"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
}

// WorkflowError represents an error in the workflow
type WorkflowError struct {
	Code      string    `json:"code"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
	Retryable bool      `json:"retryable"`
}

// NewWorkflow creates a new token minting workflow orchestrator
func NewWorkflow(db *gorm.DB, stellarClient *StellarClient, config *WorkflowConfig) *Workflow {
	if config == nil {
		config = &WorkflowConfig{
			MaxRetries:          3,
			RetryInterval:       30 * time.Second,
			ConfirmationTimeout: 5 * time.Minute,
			BatchSize:           10,
			GasOptimization:     true,
		}
	}

	return &Workflow{
		db:            db,
		stellarClient: stellarClient,
		config:        config,
	}
}

// InitiateMintingWorkflow starts a new token minting workflow
func (w *Workflow) InitiateMintingWorkflow(ctx context.Context, req *MintWorkflowRequest, userID uuid.UUID) (*MintWorkflowResponse, error) {
	// Validate credit exists and is in correct status
	var credit financing.CarbonCredit
	if err := w.db.First(&credit, "id = ?", req.CreditID).Error; err != nil {
		return nil, fmt.Errorf("credit not found: %w", err)
	}

	if credit.Status != financing.CreditStatusVerified {
		return nil, fmt.Errorf("credit must be verified before minting, current status: %s", credit.Status)
	}

	// Check if there's already a workflow for this credit
	var existingWorkflow financing.TokenMintingWorkflow
	err := w.db.Where("credit_id = ? AND status IN ?", req.CreditID, []string{
		string(financing.WorkflowStatusPending),
		string(financing.WorkflowStatusBuilding),
		string(financing.WorkflowStatusSubmitted),
	}).First(&existingWorkflow).Error

	if err == nil {
		return nil, fmt.Errorf("minting workflow already exists for credit %s", req.CreditID)
	}

	// Create workflow record
	workflow := &financing.TokenMintingWorkflow{
		CreditID:        req.CreditID,
		WorkflowType:    req.WorkflowType,
		Priority:        req.Priority,
		ContractAddress: w.getContractAddress(),
		FunctionName:    "mint",
		FunctionArgs:    w.buildFunctionArgs(req),
		Status:          financing.WorkflowStatusPending,
		MaxRetries:      w.config.MaxRetries,
		InitiatedBy:     userID,
	}

	if err := w.db.Create(workflow).Error; err != nil {
		return nil, fmt.Errorf("failed to create workflow record: %w", err)
	}

	// Start workflow processing in background
	go w.processWorkflow(ctx, workflow.ID)

	// Estimate completion time
	estimatedTime := w.estimateCompletionTime(req.WorkflowType)

	return &MintWorkflowResponse{
		WorkflowID:    workflow.ID,
		Status:        string(workflow.Status),
		EstimatedTime: estimatedTime,
		Message:       "Minting workflow initiated successfully",
	}, nil
}

// processWorkflow handles the complete workflow execution
func (w *Workflow) processWorkflow(ctx context.Context, workflowID uuid.UUID) {
	for {
		// Get current workflow state
		var workflow financing.TokenMintingWorkflow
		if err := w.db.First(&workflow, "id = ?", workflowID).Error; err != nil {
			fmt.Printf("Failed to get workflow %s: %v\n", workflowID, err)
			return
		}

		// Check if workflow is already completed or failed
		if workflow.Status == financing.WorkflowStatusCompleted ||
			workflow.Status == financing.WorkflowStatusCancelled {
			return
		}

		// Process based on current status
		var err error
		switch workflow.Status {
		case financing.WorkflowStatusPending:
			err = w.handlePendingStatus(ctx, &workflow)
		case financing.WorkflowStatusBuilding:
			err = w.handleBuildingStatus(ctx, &workflow)
		case financing.WorkflowStatusSubmitted:
			err = w.handleSubmittedStatus(ctx, &workflow)
		case financing.WorkflowStatusFailed:
			err = w.handleFailedStatus(ctx, &workflow)
		}

		if err != nil {
			// Handle workflow error
			if workflow.RetryCount < workflow.MaxRetries {
				// Schedule retry
				workflow.Status = financing.WorkflowStatusFailed
				workflow.ErrorCode = fmt.Sprintf("RETRY_%d", workflow.RetryCount+1)
				workflow.ErrorMessage = err.Error()
				workflow.NextRetryAt = &[]time.Time{time.Now().Add(w.config.RetryInterval)}[0]
				workflow.RetryCount++

				w.db.Save(&workflow)
				time.Sleep(w.config.RetryInterval)
				continue
			} else {
				// Max retries exceeded, mark as failed permanently
				workflow.Status = financing.WorkflowStatusFailed
				workflow.ErrorCode = "MAX_RETRIES_EXCEEDED"
				workflow.ErrorMessage = fmt.Sprintf("Max retries exceeded: %v", err)
				w.db.Save(&workflow)
				return
			}
		}

		// Small delay between status checks
		time.Sleep(1 * time.Second)
	}
}

// handlePendingStatus processes the pending status
func (w *Workflow) handlePendingStatus(ctx context.Context, workflow *financing.TokenMintingWorkflow) error {
	// Update status to building
	workflow.Status = financing.WorkflowStatusBuilding
	workflow.SubmittedAt = &[]time.Time{time.Now()}[0]
	return w.db.Save(workflow).Error
}

// handleBuildingStatus processes the building status
func (w *Workflow) handleBuildingStatus(ctx context.Context, workflow *financing.TokenMintingWorkflow) error {
	// Get credit details
	var credit financing.CarbonCredit
	if err := w.db.First(&credit, "id = ?", workflow.CreditID).Error; err != nil {
		return fmt.Errorf("failed to get credit: %w", err)
	}

	// Build mint request
	mintReq := &MintRequest{
		CreditID:  credit.ID.String(),
		Amount:    int64(*credit.IssuedTons), // Convert to int64
		Recipient: w.getRecipientAddress(workflow),
		AssetCode: w.generateAssetCode(&credit),
		Metadata: map[string]interface{}{
			"vintage_year":     credit.VintageYear,
			"methodology_code": credit.MethodologyCode,
			"project_id":       credit.ProjectID.String(),
			"calculation_period": map[string]interface{}{
				"start": credit.CalculationPeriodStart,
				"end":   credit.CalculationPeriodEnd,
			},
		},
	}

	// Submit to Stellar
	response, err := w.stellarClient.MintTokens(ctx, mintReq)
	if err != nil {
		return fmt.Errorf("failed to mint tokens: %w", err)
	}

	// Update workflow with transaction details
	workflow.Status = financing.WorkflowStatusSubmitted
	workflow.StellarTransactionHash = &response.TransactionHash
	workflow.SubmittedAt = &response.SubmittedAt

	// Store token IDs
	tokenIDsJSON, _ := json.Marshal(response.TokenIDs)
	workflow.FunctionArgs = datatypes.JSON(tokenIDsJSON)

	return w.db.Save(workflow).Error
}

// handleSubmittedStatus processes the submitted status
func (w *Workflow) handleSubmittedStatus(ctx context.Context, workflow *financing.TokenMintingWorkflow) error {
	if workflow.StellarTransactionHash == nil {
		return fmt.Errorf("no transaction hash available")
	}

	// Check transaction status
	txStatus, err := w.stellarClient.GetTransactionStatus(ctx, *workflow.StellarTransactionHash)
	if err != nil {
		return fmt.Errorf("failed to get transaction status: %w", err)
	}

	if txStatus.Successful {
		// Transaction confirmed, update workflow
		workflow.Status = financing.WorkflowStatusConfirmed
		workflow.StellarLedgerSequence = &[]int64{int64(txStatus.Ledger)}[0]
		workflow.ConfirmedAt = &[]time.Time{time.Now()}[0]

		// Update credit record
		if err := w.updateCreditAfterMinting(workflow); err != nil {
			return fmt.Errorf("failed to update credit after minting: %w", err)
		}

		// Mark workflow as completed
		workflow.Status = financing.WorkflowStatusCompleted
		workflow.CompletedAt = &[]time.Time{time.Now()}[0]
	} else {
		// Transaction failed
		workflow.Status = financing.WorkflowStatusFailed
		workflow.ErrorCode = "TRANSACTION_FAILED"
		workflow.ErrorMessage = txStatus.ErrorMessage
	}

	return w.db.Save(workflow).Error
}

// handleFailedStatus processes the failed status
func (w *Workflow) handleFailedStatus(ctx context.Context, workflow *financing.TokenMintingWorkflow) error {
	// Check if we should retry
	if workflow.NextRetryAt != nil && time.Now().After(*workflow.NextRetryAt) {
		// Reset to pending for retry
		workflow.Status = financing.WorkflowStatusPending
		workflow.NextRetryAt = nil
		return w.db.Save(workflow).Error
	}

	return nil
}

// updateCreditAfterMinting updates the credit record after successful minting
func (w *Workflow) updateCreditAfterMinting(workflow *financing.TokenMintingWorkflow) error {
	// Get credit
	var credit financing.CarbonCredit
	if err := w.db.First(&credit, "id = ?", workflow.CreditID).Error; err != nil {
		return err
	}

	// Update credit with minting information
	credit.Status = financing.CreditStatusMinted
	credit.MintTransactionHash = workflow.StellarTransactionHash
	credit.MintedAt = workflow.ConfirmedAt

	// Parse token IDs from function args
	var tokenIDs []string
	if err := json.Unmarshal(workflow.FunctionArgs, &tokenIDs); err == nil {
		tokenIDsJSON, _ := json.Marshal(tokenIDs)
		credit.TokenIDs = datatypes.JSON(tokenIDsJSON)
	}

	// Generate asset code and issuer
	credit.StellarAssetCode = &[]string{w.generateAssetCode(&credit)}[0]
	credit.StellarAssetIssuer = &[]string{w.stellarClient.config.IssuerSecretKey[:56]}[0] // First 56 chars of public key

	return w.db.Save(&credit).Error
}

// GetWorkflowStatus returns the current status of a workflow
func (w *Workflow) GetWorkflowStatus(ctx context.Context, workflowID uuid.UUID) (*WorkflowStatus, error) {
	var workflow financing.TokenMintingWorkflow
	if err := w.db.First(&workflow, "id = ?", workflowID).Error; err != nil {
		return nil, fmt.Errorf("workflow not found: %w", err)
	}

	status := &WorkflowStatus{
		WorkflowID: workflow.ID,
		Status:     string(workflow.Status),
		CreatedAt:  workflow.CreatedAt,
		UpdatedAt:  workflow.UpdatedAt,
	}

	// Calculate progress and current step
	status.Progress, status.CurrentStep = w.calculateProgress(&workflow)

	// Estimate completion time
	if workflow.Status == financing.WorkflowStatusPending ||
		workflow.Status == financing.WorkflowStatusBuilding ||
		workflow.Status == financing.WorkflowStatusSubmitted {
		estimated := time.Now().Add(w.config.ConfirmationTimeout)
		status.EstimatedCompletion = &estimated
	}

	// Add error information if present
	if workflow.ErrorMessage != nil {
		status.Error = &WorkflowError{
			Code:      *workflow.ErrorCode,
			Message:   *workflow.ErrorMessage,
			Timestamp: workflow.UpdatedAt,
			Retryable: workflow.RetryCount < workflow.MaxRetries,
		}
	}

	return status, nil
}

// calculateProgress calculates the progress percentage and current step
func (w *Workflow) calculateProgress(workflow *financing.TokenMintingWorkflow) (float64, string) {
	switch workflow.Status {
	case financing.WorkflowStatusPending:
		return 10.0, "Initializing workflow"
	case financing.WorkflowStatusBuilding:
		return 30.0, "Building transaction"
	case financing.WorkflowStatusSubmitted:
		return 60.0, "Transaction submitted"
	case financing.WorkflowStatusConfirmed:
		return 90.0, "Transaction confirmed"
	case financing.WorkflowStatusCompleted:
		return 100.0, "Completed"
	case financing.WorkflowStatusFailed:
		return float64(workflow.RetryCount) * 20.0, "Failed - retrying"
	default:
		return 0.0, "Unknown status"
	}
}

// CancelWorkflow cancels a minting workflow
func (w *Workflow) CancelWorkflow(ctx context.Context, workflowID uuid.UUID, reason string) error {
	result := w.db.Model(&financing.TokenMintingWorkflow{}).
		Where("id = ? AND status IN ?", workflowID, []string{
			string(financing.WorkflowStatusPending),
			string(financing.WorkflowStatusBuilding),
			string(financing.WorkflowStatusSubmitted),
		}).
		Updates(map[string]interface{}{
			"status":        financing.WorkflowStatusCancelled,
			"error_code":    "USER_CANCELLED",
			"error_message": reason,
			"updated_at":    time.Now(),
		})

	if result.Error != nil {
		return fmt.Errorf("failed to cancel workflow: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("workflow not found or cannot be cancelled")
	}

	return nil
}

// estimateCompletionTime estimates completion time based on workflow type
func (w *Workflow) estimateCompletionTime(workflowType financing.WorkflowType) int {
	switch workflowType {
	case financing.WorkflowTypeStandard:
		return 180 // 3 minutes
	case financing.WorkflowTypeBatch:
		return 300 // 5 minutes
	case financing.WorkflowTypeEmergency:
		return 60 // 1 minute
	default:
		return 180
	}
}

// Helper methods
func (w *Workflow) getContractAddress() string {
	if w.stellarClient != nil && w.stellarClient.config != nil {
		return w.stellarClient.config.ContractAddress
	}
	return "default_contract_address"
}

func (w *Workflow) getRecipientAddress(workflow *financing.TokenMintingWorkflow) string {
	// This would typically come from the project owner or a designated recipient
	// For now, return a default or look up from project
	return "default_recipient_address"
}

func (w *Workflow) generateAssetCode(credit *financing.CarbonCredit) string {
	// Generate unique asset code based on project and vintage
	return fmt.Sprintf("CARBON%d%02d", credit.VintageYear%100, credit.ID.String()[:2])
}

func (w *Workflow) buildFunctionArgs(req *MintWorkflowRequest) datatypes.JSON {
	args := map[string]interface{}{
		"workflow_type": req.WorkflowType,
		"priority":      req.Priority,
		"recipient":     req.Recipient,
		"asset_code":    req.AssetCode,
		"metadata":      req.Metadata,
	}
	argsJSON, _ := json.Marshal(args)
	return datatypes.JSON(argsJSON)
}

// ListWorkflows returns a list of workflows with optional filtering
func (w *Workflow) ListWorkflows(ctx context.Context, status *string, limit int) ([]financing.TokenMintingWorkflow, error) {
	query := w.db.Model(&financing.TokenMintingWorkflow{}).Order("created_at DESC")

	if status != nil {
		query = query.Where("status = ?", *status)
	}

	if limit > 0 {
		query = query.Limit(limit)
	}

	var workflows []financing.TokenMintingWorkflow
	if err := query.Find(&workflows).Error; err != nil {
		return nil, fmt.Errorf("failed to list workflows: %w", err)
	}

	return workflows, nil
}
