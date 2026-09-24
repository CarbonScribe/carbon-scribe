package integration

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockRepository struct {
	Repository
	recordedHealth *IntegrationHealth
	connection     *IntegrationConnection
}

func (m *mockRepository) GetConnection(ctx context.Context, id string) (*IntegrationConnection, error) {
	if m.connection != nil {
		return m.connection, nil
	}
	return &IntegrationConnection{ID: id, Provider: "stripe"}, nil
}

func (m *mockRepository) UpdateConnection(ctx context.Context, conn *IntegrationConnection) error {
	m.connection = conn
	return nil
}

func (m *mockRepository) RecordHealth(ctx context.Context, health *IntegrationHealth) error {
	m.recordedHealth = health
	return nil
}

func TestPlaceholderHealthCheckLatencyMsConstant(t *testing.T) {
	assert.Equal(t, 45, PlaceholderHealthCheckLatencyMs)
}

func TestTestConnectionUsesPlaceholderLatency(t *testing.T) {
	repo := &mockRepository{}
	svc := NewService(repo)

	err := svc.TestConnection(context.Background(), "conn-123")
	require.NoError(t, err)
	require.NotNil(t, repo.recordedHealth)
	assert.Equal(t, PlaceholderHealthCheckLatencyMs, repo.recordedHealth.LatencyMs)
	assert.Equal(t, 45, repo.recordedHealth.LatencyMs)
}
