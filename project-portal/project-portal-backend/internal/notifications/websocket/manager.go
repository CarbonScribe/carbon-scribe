package websocket

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"carbon-scribe/project-portal/project-portal-backend/internal/notifications"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Simplified for mock
	},
}

type Manager struct {
	clients map[string][]*websocket.Conn
	mu      sync.RWMutex
	repo    notifications.Repository
}

func NewManager(repo notifications.Repository) *Manager {
	return &Manager{
		clients: make(map[string][]*websocket.Conn),
		repo:    repo,
	}
}

func (m *Manager) HandleConnection(c *gin.Context) {
	userID := c.Query("userId")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "userId required"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WS upgrade failed: %v", err)
		return
	}

	m.mu.Lock()
	m.clients[userID] = append(m.clients[userID], conn)
	m.mu.Unlock()

	// Track in MongoDB
	wsConn := &notifications.WebSocketConnection{
		ID:           fmt.Sprintf("%p", conn), // Simple unique ID
		UserID:       userID,
		ConnectedAt:  time.Now(),
		LastActivity: time.Now(),
		UserAgent:    c.Request.UserAgent(),
		IPAddress:    c.ClientIP(),
	}
	_ = m.repo.SaveConnection(context.Background(), wsConn)

	defer func() {
		m.mu.Lock()
		conns := m.clients[userID]
		for i, v := range conns {
			if v == conn {
				m.clients[userID] = append(conns[:i], conns[i+1:]...)
				break
			}
		}
		if len(m.clients[userID]) == 0 {
			delete(m.clients, userID)
		}
		m.mu.Unlock()
		conn.Close()
		_ = m.repo.DeleteConnection(context.Background(), wsConn.ID)
	}()

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
		// Update activity
		wsConn.LastActivity = time.Now()
		_ = m.repo.SaveConnection(context.Background(), wsConn)
	}
}

func (m *Manager) SendMessage(userID string, message []byte) error {
	m.mu.RLock()
	conns, ok := m.clients[userID]
	m.mu.RUnlock()

	if !ok {
		return fmt.Errorf("user %s not connected", userID)
	}

	var firstErr error
	for _, conn := range conns {
		if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
			log.Printf("Failed to send WS message to user %s: %v", userID, err)
			if firstErr == nil {
				firstErr = err
			}
		}
	}
	return firstErr
}
