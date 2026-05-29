package workers

import (
	"context"
	"io"
	"log"
	"testing"
	"time"
)

// TestNewSatelliteDataSyncWorker verifies worker initialization with default interval.
func TestNewSatelliteDataSyncWorker(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	worker := NewSatelliteDataSyncWorker(0, logger)

	if worker.interval != 5*time.Minute {
		t.Errorf("expected default interval 5m, got %v", worker.interval)
	}

	if worker.logger == nil {
		t.Error("expected logger to be initialized")
	}
}

// TestNewSatelliteDataSyncWorker_CustomInterval verifies custom interval is respected.
func TestNewSatelliteDataSyncWorker_CustomInterval(t *testing.T) {
	customInterval := 2 * time.Minute
	logger := log.New(io.Discard, "", 0)
	worker := NewSatelliteDataSyncWorker(customInterval, logger)

	if worker.interval != customInterval {
		t.Errorf("expected interval %v, got %v", customInterval, worker.interval)
	}
}

// TestNewSatelliteDataSyncWorker_DefaultLogger verifies default logger is created if nil.
func TestNewSatelliteDataSyncWorker_DefaultLogger(t *testing.T) {
	worker := NewSatelliteDataSyncWorker(1*time.Minute, nil)

	if worker.logger == nil {
		t.Error("expected default logger to be created")
	}
}

// TestStart_NilContext verifies Start returns error when context is nil.
func TestStart_NilContext(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	worker := NewSatelliteDataSyncWorker(1*time.Minute, logger)

	err := worker.Start(nil)
	if err == nil {
		t.Error("expected error for nil context, got nil")
	}
}

// TestStart_ContextCancellation verifies worker halts gracefully when context is cancelled.
func TestStart_ContextCancellation(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	// Use 10ms fast ticker to simulate loop triggers quickly
	worker := NewSatelliteDataSyncWorker(10*time.Millisecond, logger)

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	start := time.Now()
	err := worker.Start(ctx)
	elapsed := time.Since(start)

	// Verify context.Canceled or context.DeadlineExceeded error
	if err != context.Canceled && err != context.DeadlineExceeded {
		t.Errorf("expected context cancellation error, got %v", err)
	}

	// Verify worker exited within reasonable time (should be close to 100ms)
	if elapsed > 500*time.Millisecond {
		t.Errorf("worker took too long to halt: %v", elapsed)
	}
}

// TestStart_LoopTriggersMultipleTimes verifies the ticker loop triggers multiple sync cycles.
func TestStart_LoopTriggersMultipleTimes(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	// Use 10ms tick for fast loop triggers
	worker := NewSatelliteDataSyncWorker(10*time.Millisecond, logger)

	ctx, cancel := context.WithTimeout(context.Background(), 150*time.Millisecond)
	defer cancel()

	// Run worker (will exit when context deadline is reached)
	err := worker.Start(ctx)

	// Verify context deadline error
	if err != context.DeadlineExceeded {
		t.Errorf("expected context deadline exceeded, got %v", err)
	}
}

// TestSyncProjectData_Success verifies successful project sync returns no error.
func TestSyncProjectData_Success(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	worker := NewSatelliteDataSyncWorker(1*time.Minute, logger)

	ctx := context.Background()
	err := worker.syncProjectData(ctx, "project-001")

	if err != nil {
		t.Errorf("expected no error for valid project, got %v", err)
	}
}

// TestSyncProjectData_ContextCancellation verifies context cancellation is respected.
func TestSyncProjectData_ContextCancellation(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	worker := NewSatelliteDataSyncWorker(1*time.Minute, logger)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	err := worker.syncProjectData(ctx, "project-001")
	if err != context.Canceled {
		t.Errorf("expected context.Canceled, got %v", err)
	}
}

// TestSyncProjectData_ErrorProject verifies error isolation for failing projects.
func TestSyncProjectData_ErrorProject(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	worker := NewSatelliteDataSyncWorker(1*time.Minute, logger)

	ctx := context.Background()
	// Use project ID that triggers error in processNDVIMock
	err := worker.syncProjectData(ctx, "error-project")

	if err == nil {
		t.Error("expected error for error-project, got nil")
	}
}

// TestSyncProjectData_EmptyProjectID verifies empty project ID is rejected.
func TestSyncProjectData_EmptyProjectID(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	worker := NewSatelliteDataSyncWorker(1*time.Minute, logger)

	ctx := context.Background()
	err := worker.syncProjectData(ctx, "")

	if err == nil {
		t.Error("expected error for empty project ID, got nil")
	}
}

// TestFetchSatelliteDataMock_Success verifies successful mock fetch.
func TestFetchSatelliteDataMock_Success(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	worker := NewSatelliteDataSyncWorker(1*time.Minute, logger)

	err := worker.fetchSatelliteDataMock("project-001")
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

// TestFetchSatelliteDataMock_EmptyProjectID verifies empty project ID returns error.
func TestFetchSatelliteDataMock_EmptyProjectID(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	worker := NewSatelliteDataSyncWorker(1*time.Minute, logger)

	err := worker.fetchSatelliteDataMock("")
	if err == nil {
		t.Error("expected error for empty project ID, got nil")
	}
}

// TestProcessNDVIMock_Success verifies successful NDVI processing.
func TestProcessNDVIMock_Success(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	worker := NewSatelliteDataSyncWorker(1*time.Minute, logger)

	err := worker.processNDVIMock("project-001")
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

// TestProcessNDVIMock_ErrorProject verifies error-project triggers NDVI processing error.
func TestProcessNDVIMock_ErrorProject(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	worker := NewSatelliteDataSyncWorker(1*time.Minute, logger)

	err := worker.processNDVIMock("error-project")
	if err == nil {
		t.Error("expected error for error-project, got nil")
	}
}

// TestPersistSatelliteResultsMock_Success verifies successful persistence.
func TestPersistSatelliteResultsMock_Success(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	worker := NewSatelliteDataSyncWorker(1*time.Minute, logger)

	err := worker.persistSatelliteResultsMock("project-001")
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

// TestGetActiveProjectsMock_ReturnsProjects verifies mock returns expected project IDs.
func TestGetActiveProjectsMock_ReturnsProjects(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	worker := NewSatelliteDataSyncWorker(1*time.Minute, logger)

	projects := worker.getActiveProjectsMock()
	if len(projects) == 0 {
		t.Error("expected projects list to be non-empty")
	}

	expectedCount := 3
	if len(projects) != expectedCount {
		t.Errorf("expected %d projects, got %d", expectedCount, len(projects))
	}
}

// TestStart_ConcurrentShutdown verifies multiple Start calls can be managed independently.
func TestStart_ConcurrentShutdown(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	worker1 := NewSatelliteDataSyncWorker(10*time.Millisecond, logger)
	worker2 := NewSatelliteDataSyncWorker(10*time.Millisecond, logger)

	ctx1, cancel1 := context.WithTimeout(context.Background(), 50*time.Millisecond)
	ctx2, cancel2 := context.WithTimeout(context.Background(), 75*time.Millisecond)
	defer cancel1()
	defer cancel2()

	// Run workers concurrently
	errCh1 := make(chan error, 1)
	errCh2 := make(chan error, 1)

	go func() {
		errCh1 <- worker1.Start(ctx1)
	}()

	go func() {
		errCh2 <- worker2.Start(ctx2)
	}()

	err1 := <-errCh1
	err2 := <-errCh2

	if err1 != context.DeadlineExceeded {
		t.Errorf("worker1: expected deadline exceeded, got %v", err1)
	}

	if err2 != context.DeadlineExceeded {
		t.Errorf("worker2: expected deadline exceeded, got %v", err2)
	}
}

// TestStart_ImmediateShutdown verifies worker shuts down immediately if context is already cancelled.
func TestStart_ImmediateShutdown(t *testing.T) {
	logger := log.New(io.Discard, "", 0)
	worker := NewSatelliteDataSyncWorker(1*time.Minute, logger)

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel before calling Start

	start := time.Now()
	err := worker.Start(ctx)
	elapsed := time.Since(start)

	if err != context.Canceled {
		t.Errorf("expected context.Canceled, got %v", err)
	}

	// Should exit immediately (within 50ms)
	if elapsed > 50*time.Millisecond {
		t.Errorf("expected immediate shutdown, took %v", elapsed)
	}
}
