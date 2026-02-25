package websocket

import (
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"carbon-scribe/project-portal/project-portal-backend/internal/notifications"
)

// Manager handles WebSocket connections and message routing
type Manager struct {
	connections map[string]*Connection
	mu          sync.RWMutex
	hub         *Hub
	upgrader    websocket.Upgrader
}

// Connection represents a WebSocket client connection
type Connection struct {
	ID           string
	UserID       string
	ProjectIDs   []string
	Conn         *websocket.Conn
	Send         chan notifications.WebSocketMessage
	LastActivity time.Time
	UserAgent    string
	IPAddress    string
	mu           sync.Mutex
}

// Hub manages the broadcast of messages to connections
type Hub struct {
	connections map[*Connection]bool
	broadcast   chan notifications.WebSocketMessage
	register    chan *Connection
	unregister  chan *Connection
	stop        chan struct{}
}

// NewManager creates a new WebSocket manager
func NewManager() *Manager {
	hub := &Hub{
		connections: make(map[*Connection]bool),
		broadcast:   make(chan notifications.WebSocketMessage, 256),
		register:    make(chan *Connection),
		unregister:  make(chan *Connection),
		stop:        make(chan struct{}),
	}

	go hub.run()

	return &Manager{
		connections: make(map[string]*Connection),
		hub:         hub,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				// In production, implement proper origin checking
				return true
			},
		},
	}
}

// HandleConnection handles new WebSocket connections
func (m *Manager) HandleConnection(w http.ResponseWriter, r *http.Request) (*Connection, error) {
	// Upgrade HTTP connection to WebSocket
	conn, err := m.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to upgrade connection: %w", err)
	}

	// Extract user information from JWT token or session
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		// For demo purposes, generate a random user ID
		userID = uuid.New().String()
	}

	// Create connection
	connection := &Connection{
		ID:           uuid.New().String(),
		UserID:       userID,
		Conn:         conn,
		Send:         make(chan notifications.WebSocketMessage, 256),
		LastActivity: time.Now(),
		UserAgent:    r.Header.Get("User-Agent"),
		IPAddress:    r.RemoteAddr,
	}

	// Register connection
	m.hub.register <- connection

	// Store connection in manager
	m.mu.Lock()
	m.connections[connection.ID] = connection
	m.mu.Unlock()

	// Start goroutines for reading and writing
	go m.readPump(connection)
	go m.writePump(connection)

	return connection, nil
}

// readPump pumps messages from the WebSocket connection to the hub
func (m *Manager) readPump(conn *Connection) {
	defer func() {
		m.hub.unregister <- conn
		conn.Conn.Close()
	}()

	conn.Conn.SetReadLimit(512)
	conn.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.Conn.SetPongHandler(func(string) error {
		conn.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		var msg notifications.WebSocketMessage
		err := conn.Conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}

		// Update last activity
		conn.mu.Lock()
		conn.LastActivity = time.Now()
		conn.mu.Unlock()

		// Handle incoming messages
		m.handleMessage(conn, &msg)
	}
}

// writePump pumps messages from the hub to the WebSocket connection
func (m *Manager) writePump(conn *Connection) {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		conn.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-conn.Send:
			conn.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				conn.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := conn.Conn.WriteJSON(message); err != nil {
				return
			}

		case <-ticker.C:
			conn.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage processes incoming WebSocket messages
func (m *Manager) handleMessage(conn *Connection, msg *notifications.WebSocketMessage) {
	switch msg.Type {
	case notifications.WSMessageTypePresence:
		// Handle presence updates
		m.handlePresenceMessage(conn, msg)
	case notifications.WSMessageTypePrivate:
		// Handle private messages
		m.handlePrivateMessage(conn, msg)
	case notifications.WSMessageTypeBroadcast:
		// Handle broadcast messages (admin only)
		m.handleBroadcastMessage(conn, msg)
	default:
		log.Printf("Unknown message type: %s", msg.Type)
	}
}

// handlePresenceMessage handles presence updates
func (m *Manager) handlePresenceMessage(conn *Connection, msg *notifications.WebSocketMessage) {
	// Update connection metadata
	if projectIDs, ok := msg.Data["project_ids"].([]interface{}); ok {
		var ids []string
		for _, id := range projectIDs {
			if str, ok := id.(string); ok {
				ids = append(ids, str)
			}
		}

		conn.mu.Lock()
		conn.ProjectIDs = ids
		conn.mu.Unlock()
	}

	// Send presence confirmation
	response := notifications.WebSocketMessage{
		Type:      notifications.WSMessageTypeStatus,
		Data:      map[string]interface{}{"status": "connected", "connection_id": conn.ID},
		Timestamp: time.Now(),
		Channel:   "private",
		Target:    conn.UserID,
	}

	select {
	case conn.Send <- response:
	default:
		close(conn.Send)
	}
}

// handlePrivateMessage handles private messages between users
func (m *Manager) handlePrivateMessage(conn *Connection, msg *notifications.WebSocketMessage) {
	targetUserID, ok := msg.Data["target_user_id"].(string)
	if !ok {
		return
	}

	// Find target connection
	m.mu.RLock()
	for _, targetConn := range m.connections {
		if targetConn.UserID == targetUserID {
			// Send message to target user
			response := notifications.WebSocketMessage{
				Type:      notifications.WSMessageTypePrivate,
				Data:      msg.Data,
				Timestamp: time.Now(),
				Channel:   "private",
				Target:    targetUserID,
				Source:    conn.UserID,
			}

			select {
			case targetConn.Send <- response:
			default:
				close(targetConn.Send)
			}
			break
		}
	}
	m.mu.RUnlock()
}

// handleBroadcastMessage handles broadcast messages (admin only)
func (m *Manager) handleBroadcastMessage(conn *Connection, msg *notifications.WebSocketMessage) {
	// In production, verify admin permissions
	// For now, allow all broadcasts

	broadcast := notifications.WebSocketMessage{
		Type:      notifications.WSMessageTypeBroadcast,
		Data:      msg.Data,
		Timestamp: time.Now(),
		Channel:   "broadcast",
		Target:    "all",
		Source:    conn.UserID,
	}

	select {
	case m.hub.broadcast <- broadcast:
	default:
		log.Printf("Broadcast channel full, dropping message")
	}
}

// run runs the hub in its own goroutine
func (h *Hub) run() {
	for {
		select {
		case conn := <-h.register:
			h.connections[conn] = true
			log.Printf("Connection registered: %s (User: %s)", conn.ID, conn.UserID)

		case conn := <-h.unregister:
			if _, ok := h.connections[conn]; ok {
				delete(h.connections, conn)
				close(conn.Send)
				log.Printf("Connection unregistered: %s (User: %s)", conn.ID, conn.UserID)
			}

		case message := <-h.broadcast:
			for conn := range h.connections {
				select {
				case conn.Send <- message:
				default:
					close(conn.Send)
					delete(h.connections, conn)
				}
			}

		case <-h.stop:
			for conn := range h.connections {
				close(conn.Send)
				delete(h.connections, conn)
			}
			return
		}
	}
}

// SendToUser sends a message to a specific user
func (m *Manager) SendToUser(userID string, message notifications.WebSocketMessage) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, conn := range m.connections {
		if conn.UserID == userID {
			message.Target = userID
			select {
			case conn.Send <- message:
				return nil
			default:
				return fmt.Errorf("user connection buffer full")
			}
		}
	}

	return fmt.Errorf("user not connected")
}

// SendToProject sends a message to all users in a project
func (m *Manager) SendToProject(projectID string, message notifications.WebSocketMessage) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	sent := 0
	for _, conn := range m.connections {
		conn.mu.Lock()
		for _, pid := range conn.ProjectIDs {
			if pid == projectID {
				message.Target = projectID
				message.Channel = "project"
				select {
				case conn.Send <- message:
					sent++
				default:
					// Connection buffer full, skip
				}
				break
			}
		}
		conn.mu.Unlock()
	}

	if sent == 0 {
		return fmt.Errorf("no users connected to project %s", projectID)
	}

	return nil
}

// Broadcast sends a message to all connected users
func (m *Manager) Broadcast(message notifications.WebSocketMessage) error {
	select {
	case m.hub.broadcast <- message:
		return nil
	default:
		return fmt.Errorf("broadcast channel full")
	}
}

// GetConnectionCount returns the number of active connections
func (m *Manager) GetConnectionCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.connections)
}

// GetProjectConnections returns the number of connections for a specific project
func (m *Manager) GetProjectConnections(projectID string) int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	count := 0
	for _, conn := range m.connections {
		conn.mu.Lock()
		for _, pid := range conn.ProjectIDs {
			if pid == projectID {
				count++
				break
			}
		}
		conn.mu.Unlock()
	}

	return count
}

// GetUserConnections returns all connections for a specific user
func (m *Manager) GetUserConnections(userID string) []*Connection {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var connections []*Connection
	for _, conn := range m.connections {
		if conn.UserID == userID {
			connections = append(connections, conn)
		}
	}

	return connections
}

// Close closes the WebSocket manager and all connections
func (m *Manager) Close() {
	close(m.hub.stop)

	m.mu.Lock()
	for _, conn := range m.connections {
		conn.Conn.Close()
		close(conn.Send)
	}
	m.connections = make(map[string]*Connection)
	m.mu.Unlock()
}

// ConnectionInfo represents connection information for monitoring
type ConnectionInfo struct {
	ConnectionID string    `json:"connection_id"`
	UserID       string    `json:"user_id"`
	ProjectIDs   []string  `json:"project_ids"`
	ConnectedAt  time.Time `json:"connected_at"`
	LastActivity time.Time `json:"last_activity"`
	UserAgent    string    `json:"user_agent"`
	IPAddress    string    `json:"ip_address"`
}

// GetConnectionInfo returns information about all active connections
func (m *Manager) GetConnectionInfo() []ConnectionInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var info []ConnectionInfo
	for _, conn := range m.connections {
		conn.mu.Lock()
		connInfo := ConnectionInfo{
			ConnectionID: conn.ID,
			UserID:       conn.UserID,
			ProjectIDs:   make([]string, len(conn.ProjectIDs)),
			ConnectedAt:  conn.LastActivity, // Approximate
			LastActivity: conn.LastActivity,
			UserAgent:    conn.UserAgent,
			IPAddress:    conn.IPAddress,
		}
		copy(connInfo.ProjectIDs, conn.ProjectIDs)
		conn.mu.Unlock()

		info = append(info, connInfo)
	}

	return info
}

// DisconnectUser disconnects all connections for a specific user
func (m *Manager) DisconnectUser(userID string) {
	m.mu.RLock()
	connections := make([]*Connection, 0)
	for _, conn := range m.connections {
		if conn.UserID == userID {
			connections = append(connections, conn)
		}
	}
	m.mu.RUnlock()

	for _, conn := range connections {
		conn.Conn.Close()
	}
}

// DisconnectFromProject disconnects users from a specific project
func (m *Manager) DisconnectFromProject(projectID string) {
	m.mu.RLock()
	for _, conn := range m.connections {
		conn.mu.Lock()
		var newProjectIDs []string
		for _, pid := range conn.ProjectIDs {
			if pid != projectID {
				newProjectIDs = append(newProjectIDs, pid)
			}
		}
		conn.ProjectIDs = newProjectIDs
		conn.mu.Unlock()
	}
	m.mu.RUnlock()
}
