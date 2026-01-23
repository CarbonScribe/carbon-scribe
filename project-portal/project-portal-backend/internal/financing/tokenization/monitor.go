package tokenization

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"
)

// CreditStatus represents the status of a carbon credit
type CreditStatus string

const (
	CreditStatusCalculated CreditStatus = "calculated"
	CreditStatusVerified   CreditStatus = "verified"
	CreditStatusMinting    CreditStatus = "minting"
	CreditStatusMinted     CreditStatus = "minted"
	CreditStatusRetired    CreditStatus = "retired"
)

// TransactionMonitor monitors Stellar transactions and handles confirmations
type TransactionMonitor struct {
	stellarClient *StellarClient
	repository    Repository
	monitors      map[string]*TransactionMonitoringSession
	mutex         sync.RWMutex
	config        *MonitorConfig
}

// MonitorConfig holds monitoring configuration
type MonitorConfig struct {
	PollingInterval    time.Duration `json:"polling_interval"`
	MaxMonitoringTime  time.Duration `json:"max_monitoring_time"`
	MaxConcurrentMonitors int         `json:"max_concurrent_monitors"`
	RetryOnFailure     bool          `json:"retry_on_failure"`
	MaxRetries         int           `json:"max_retries"`
}

// TransactionMonitoringSession represents an active monitoring session
type TransactionMonitoringSession struct {
	TransactionID string
	BatchID       string
	Status        MonitorStatus
	StartedAt     time.Time
	LastChecked   time.Time
	CheckCount    int
	RetryCount    int
	Error         *string
	CompletedAt   *time.Time
	Result        *MonitoringResult
}

// MonitorStatus represents the status of transaction monitoring
type MonitorStatus string

const (
	MonitorStatusActive    MonitorStatus = "active"
	MonitorStatusCompleted MonitorStatus = "completed"
	MonitorStatusFailed    MonitorStatus = "failed"
	MonitorStatusTimeout   MonitorStatus = "timeout"
)

// MonitoringResult represents the result of transaction monitoring
type MonitoringResult struct {
	TransactionID string
	Status        TransactionStatus
	ConfirmedAt   time.Time
	TokenIDs      []string
	AssetCode     string
	Operations    []Operation
	Success       bool
	Error         *string
}

// MonitoringEvent represents a monitoring event
type MonitoringEvent struct {
	Type        string      `json:"type"`
	TransactionID string    `json:"transaction_id"`
	BatchID     string      `json:"batch_id"`
	Status      string      `json:"status"`
	Timestamp   time.Time   `json:"timestamp"`
	Data        interface{} `json:"data,omitempty"`
}

// EventListener defines the interface for monitoring event listeners
type EventListener interface {
	OnMonitoringEvent(event MonitoringEvent)
}

// NewTransactionMonitor creates a new transaction monitor
func NewTransactionMonitor(stellarClient *StellarClient, repository Repository, config *MonitorConfig) *TransactionMonitor {
	if config == nil {
		config = &MonitorConfig{
			PollingInterval:      10 * time.Second,
			MaxMonitoringTime:    30 * time.Minute,
			MaxConcurrentMonitors: 50,
			RetryOnFailure:       true,
			MaxRetries:           3,
		}
	}
	
	return &TransactionMonitor{
		stellarClient: stellarClient,
		repository:    repository,
		monitors:      make(map[string]*TransactionMonitoringSession),
		config:        config,
	}
}

// StartMonitoring starts monitoring a transaction
func (tm *TransactionMonitor) StartMonitoring(ctx context.Context, transactionID, batchID string) error {
	tm.mutex.Lock()
	defer tm.mutex.Unlock()
	
	// Check if already monitoring
	if _, exists := tm.monitors[transactionID]; exists {
		return fmt.Errorf("transaction %s is already being monitored", transactionID)
	}
	
	// Check concurrent monitor limit
	if len(tm.monitors) >= tm.config.MaxConcurrentMonitors {
		return fmt.Errorf("maximum concurrent monitors (%d) reached", tm.config.MaxConcurrentMonitors)
	}
	
	// Create monitoring session
	session := &TransactionMonitoringSession{
		TransactionID: transactionID,
		BatchID:       batchID,
		Status:        MonitorStatusActive,
		StartedAt:     time.Now(),
		LastChecked:   time.Now(),
		CheckCount:    0,
		RetryCount:    0,
	}
	
	tm.monitors[transactionID] = session
	
	// Start monitoring in background
	go tm.monitorTransaction(ctx, session)
	
	log.Printf("Started monitoring transaction %s for batch %s", transactionID, batchID)
	
	return nil
}

// StopMonitoring stops monitoring a transaction
func (tm *TransactionMonitor) StopMonitoring(transactionID string) error {
	tm.mutex.Lock()
	defer tm.mutex.Unlock()
	
	session, exists := tm.monitors[transactionID]
	if !exists {
		return fmt.Errorf("transaction %s is not being monitored", transactionID)
	}
	
	// Mark as completed
	session.Status = MonitorStatusCompleted
	completedAt := time.Now()
	session.CompletedAt = &completedAt
	
	delete(tm.monitors, transactionID)
	
	log.Printf("Stopped monitoring transaction %s", transactionID)
	
	return nil
}

// GetMonitoringStatus gets the status of a monitoring session
func (tm *TransactionMonitor) GetMonitoringStatus(transactionID string) (*TransactionMonitoringSession, error) {
	tm.mutex.RLock()
	defer tm.mutex.RUnlock()
	
	session, exists := tm.monitors[transactionID]
	if !exists {
		return nil, fmt.Errorf("transaction %s is not being monitored", transactionID)
	}
	
	return session, nil
}

// ListActiveMonitors lists all active monitoring sessions
func (tm *TransactionMonitor) ListActiveMonitors() []*TransactionMonitoringSession {
	tm.mutex.RLock()
	defer tm.mutex.RUnlock()
	
	sessions := make([]*TransactionMonitoringSession, 0, len(tm.monitors))
	for _, session := range tm.monitors {
		if session.Status == MonitorStatusActive {
			sessions = append(sessions, session)
		}
	}
	
	return sessions
}

// monitorTransaction monitors a single transaction
func (tm *TransactionMonitor) monitorTransaction(ctx context.Context, session *TransactionMonitoringSession) {
	defer tm.cleanupSession(session.TransactionID)
	
	ticker := time.NewTicker(tm.config.PollingInterval)
	defer ticker.Stop()
	
	timeout := time.After(tm.config.MaxMonitoringTime)
	
	for {
		select {
		case <-ctx.Done():
			log.Printf("Monitoring cancelled for transaction %s", session.TransactionID)
			return
			
		case <-timeout:
			tm.handleTimeout(session)
			return
			
		case <-ticker.C:
			if err := tm.checkTransaction(ctx, session); err != nil {
				log.Printf("Error checking transaction %s: %v", session.TransactionID, err)
				
				if tm.config.RetryOnFailure && session.RetryCount < tm.config.MaxRetries {
					session.RetryCount++
					continue
				}
				
				tm.handleFailure(session, err)
				return
			}
			
			// Check if monitoring is complete
			if session.Status != MonitorStatusActive {
				return
			}
		}
	}
}

// checkTransaction checks the status of a transaction
func (tm *TransactionMonitor) checkTransaction(ctx context.Context, session *TransactionMonitoringSession) error {
	session.LastChecked = time.Now()
	session.CheckCount++
	
	// Query transaction status
	transaction, err := tm.stellarClient.GetTransactionStatus(ctx, session.TransactionID)
	if err != nil {
		return fmt.Errorf("failed to get transaction status: %w", err)
	}
	
	// Update session based on transaction status
	switch transaction.Status {
	case TransactionStatusSuccess:
		return tm.handleSuccess(session, transaction)
		
	case TransactionStatusFailed:
		return tm.handleTransactionFailure(session, transaction)
		
	case TransactionStatusPending:
		// Continue monitoring
		return nil
		
	case TransactionStatusTimeout:
		return tm.handleTimeout(session)
		
	default:
		return fmt.Errorf("unknown transaction status: %s", transaction.Status)
	}
}

// handleSuccess handles successful transaction confirmation
func (tm *TransactionMonitor) handleSuccess(session *TransactionMonitoringSession, transaction *StellarTransaction) error {
	// Create monitoring result
	result := &MonitoringResult{
		TransactionID: transaction.ID,
		Status:        transaction.Status,
		ConfirmedAt:   *transaction.ConfirmedAt,
		Operations:    transaction.Operations,
		Success:       true,
	}
	
	// Extract token information from operations
	tokenIDs, assetCode := tm.extractTokenInfo(transaction.Operations)
	result.TokenIDs = tokenIDs
	result.AssetCode = assetCode
	
	// Update session
	session.Status = MonitorStatusCompleted
	session.CompletedAt = transaction.ConfirmedAt
	session.Result = result
	
	// Update credit records in database
	if err := tm.updateCreditRecords(session.BatchID, result); err != nil {
		log.Printf("Failed to update credit records for batch %s: %v", session.BatchID, err)
	}
	
	// Emit success event
	tm.emitEvent(MonitoringEvent{
		Type:          "transaction_confirmed",
		TransactionID: session.TransactionID,
		BatchID:       session.BatchID,
		Status:        string(MonitorStatusCompleted),
		Timestamp:     time.Now(),
		Data:          result,
	})
	
	log.Printf("Transaction %s confirmed successfully for batch %s", session.TransactionID, session.BatchID)
	
	return nil
}

// handleTransactionFailure handles failed transaction
func (tm *TransactionMonitor) handleTransactionFailure(session *TransactionMonitoringSession, transaction *StellarTransaction) error {
	errorMsg := transaction.FailureReason
	if errorMsg == "" {
		errorMsg = "Transaction failed without specific reason"
	}
	
	// Update session
	session.Status = MonitorStatusFailed
	session.Error = &errorMsg
	completedAt := time.Now()
	session.CompletedAt = &completedAt
	
	// Create monitoring result
	result := &MonitoringResult{
		TransactionID: transaction.ID,
		Status:        transaction.Status,
		Success:       false,
		Error:         &errorMsg,
	}
	session.Result = result
	
	// Update credit records to failed status
	if err := tm.updateCreditRecordsToFailed(session.BatchID, errorMsg); err != nil {
		log.Printf("Failed to update credit records to failed for batch %s: %v", session.BatchID, err)
	}
	
	// Emit failure event
	tm.emitEvent(MonitoringEvent{
		Type:          "transaction_failed",
		TransactionID: session.TransactionID,
		BatchID:       session.BatchID,
		Status:        string(MonitorStatusFailed),
		Timestamp:     time.Now(),
		Data:          result,
	})
	
	log.Printf("Transaction %s failed for batch %s: %s", session.TransactionID, session.BatchID, errorMsg)
	
	return fmt.Errorf("transaction failed: %s", errorMsg)
}

// handleTimeout handles monitoring timeout
func (tm *TransactionMonitor) handleTimeout(session *TransactionMonitoringSession) error {
	errorMsg := fmt.Sprintf("Transaction monitoring timed out after %v", tm.config.MaxMonitoringTime)
	
	// Update session
	session.Status = MonitorStatusTimeout
	session.Error = &errorMsg
	completedAt := time.Now()
	session.CompletedAt = &completedAt
	
	// Update credit records to failed status
	if err := tm.updateCreditRecordsToFailed(session.BatchID, errorMsg); err != nil {
		log.Printf("Failed to update credit records to failed for batch %s: %v", session.BatchID, err)
	}
	
	// Emit timeout event
	tm.emitEvent(MonitoringEvent{
		Type:          "monitoring_timeout",
		TransactionID: session.TransactionID,
		BatchID:       session.BatchID,
		Status:        string(MonitorStatusTimeout),
		Timestamp:     time.Now(),
		Data: map[string]interface{}{
			"timeout_duration": tm.config.MaxMonitoringTime,
			"checks_performed": session.CheckCount,
		},
	})
	
	log.Printf("Transaction monitoring timed out for %s after %d checks", session.TransactionID, session.CheckCount)
	
	return fmt.Errorf("monitoring timeout")
}

// handleFailure handles general monitoring failure
func (tm *TransactionMonitor) handleFailure(session *TransactionMonitoringSession, err error) {
	errorMsg := err.Error()
	
	// Update session
	session.Status = MonitorStatusFailed
	session.Error = &errorMsg
	completedAt := time.Now()
	session.CompletedAt = &completedAt
	
	// Update credit records to failed status
	if err := tm.updateCreditRecordsToFailed(session.BatchID, errorMsg); err != nil {
		log.Printf("Failed to update credit records to failed for batch %s: %v", session.BatchID, err)
	}
	
	// Emit failure event
	tm.emitEvent(MonitoringEvent{
		Type:          "monitoring_failed",
		TransactionID: session.TransactionID,
		BatchID:       session.BatchID,
		Status:        string(MonitorStatusFailed),
		Timestamp:     time.Now(),
		Data: map[string]interface{}{
			"error":       errorMsg,
			"retry_count": session.RetryCount,
		},
	})
	
	log.Printf("Transaction monitoring failed for %s: %v", session.TransactionID, err)
}

// extractTokenInfo extracts token information from transaction operations
func (tm *TransactionMonitor) extractTokenInfo(operations []Operation) ([]string, string) {
	var tokenIDs []string
	var assetCode string
	
	for _, op := range operations {
		if op.Type == "invoke_contract_function" {
			// Extract token information from contract call result
			// In a real implementation, this would parse the contract result
			tokenIDs = append(tokenIDs, fmt.Sprintf("token_%s", op.Source))
			if assetCode == "" {
				assetCode = "CARBON2024" // Default
			}
		}
	}
	
	return tokenIDs, assetCode
}

// updateCreditRecords updates credit records after successful confirmation
func (tm *TransactionMonitor) updateCreditRecords(batchID string, result *MonitoringResult) error {
	ctx := context.Background()
	
	// Get minting batch
	batch, err := tm.repository.GetMintingBatch(ctx, batchID)
	if err != nil {
		return fmt.Errorf("failed to get minting batch: %w", err)
	}
	
	// Update credit status to minted
	for _, creditID := range batch.CreditIDs {
		err := tm.repository.UpdateCreditMintingStatus(ctx, creditID, CreditStatusMinted, &result.TransactionID, result.TokenIDs)
		if err != nil {
			log.Printf("Failed to update credit %s: %v", creditID, err)
			continue
		}
	}
	
	// Update batch status
	err = tm.repository.UpdateMintingBatch(ctx, batchID, BatchStatusCompleted, &result.TransactionID)
	if err != nil {
		return fmt.Errorf("failed to update batch status: %w", err)
	}
	
	return nil
}

// updateCreditRecordsToFailed updates credit records to failed status
func (tm *TransactionMonitor) updateCreditRecordsToFailed(batchID string, errorMsg string) error {
	ctx := context.Background()
	
	// Get minting batch
	batch, err := tm.repository.GetMintingBatch(ctx, batchID)
	if err != nil {
		return fmt.Errorf("failed to get minting batch: %w", err)
	}
	
	// Update credit status back to calculated
	for _, creditID := range batch.CreditIDs {
		err := tm.repository.UpdateCreditMintingStatus(ctx, creditID, CreditStatusCalculated, nil, nil)
		if err != nil {
			log.Printf("Failed to reset credit %s: %v", creditID, err)
			continue
		}
	}
	
	// Update batch status
	err = tm.repository.UpdateMintingBatch(ctx, batchID, BatchStatusFailed, nil)
	if err != nil {
		return fmt.Errorf("failed to update batch status: %w", err)
	}
	
	return nil
}

// cleanupSession cleans up a monitoring session
func (tm *TransactionMonitor) cleanupSession(transactionID string) {
	tm.mutex.Lock()
	defer tm.mutex.Unlock()
	
	delete(tm.monitors, transactionID)
}

// emitEvent emits a monitoring event
func (tm *TransactionMonitor) emitEvent(event MonitoringEvent) {
	// In a real implementation, this would send events to message queue or webhook
	log.Printf("Monitoring event: %s - %s", event.Type, event.TransactionID)
}

// GetMonitoringStats returns monitoring statistics
func (tm *TransactionMonitor) GetMonitoringStats() map[string]interface{} {
	tm.mutex.RLock()
	defer tm.mutex.RUnlock()
	
	stats := map[string]interface{}{
		"active_monitors": len(tm.monitors),
		"max_concurrent":  tm.config.MaxConcurrentMonitors,
		"polling_interval": tm.config.PollingInterval,
		"max_monitoring_time": tm.config.MaxMonitoringTime,
	}
	
	// Calculate average monitoring time
	var totalDuration time.Duration
	completedCount := 0
	
	for _, session := range tm.monitors {
		if session.CompletedAt != nil {
			totalDuration += session.CompletedAt.Sub(session.StartedAt)
			completedCount++
		}
	}
	
	if completedCount > 0 {
		stats["average_duration"] = totalDuration / time.Duration(completedCount)
	}
	
	return stats
}
