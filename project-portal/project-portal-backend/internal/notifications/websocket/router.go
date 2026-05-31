package websocket

import (
	"context"
	"fmt"
	"log"
)

// Event represents an incoming WebSocket payload from API Gateway
type Event struct {
	RouteKey     string                 `json:"routeKey"`
	ConnectionID string                 `json:"connectionId"`
	UserID       string                 `json:"userId,omitempty"`
	Body         string                 `json:"body,omitempty"`
	Headers      map[string]string      `json:"headers,omitempty"`
	QueryString  map[string]string      `json:"queryStringParameters,omitempty"`
	RequestContext RequestContext        `json:"requestContext"`
}

// RequestContext represents API Gateway request context details
type RequestContext struct {
	ConnectionID string `json:"connectionId"`
	RouteKey     string `json:"routeKey"`
	DomainName   string `json:"domainName,omitempty"`
	Stage        string `json:"stage,omitempty"`
	Identity     struct {
		SourceAgent string `json:"userAgent,omitempty"`
		SourceIP    string `json:"sourceIp,omitempty"`
	} `json:"identity"`
}

// Handler is a function type to process incoming WebSocket events
type Handler func(ctx context.Context, event Event) (interface{}, error)

// Router routes WebSocket actions based on RouteKey
type Router struct {
	handlers map[string]Handler
}

// NewRouter creates a new instance of Router
func NewRouter() *Router {
	return &Router{
		handlers: make(map[string]Handler),
	}
}

// Register adds a handler for a specific route key
func (r *Router) Register(routeKey string, handler Handler) {
	r.handlers[routeKey] = handler
}

// Route processes the event by executing the registered handler for its RouteKey
func (r *Router) Route(ctx context.Context, event Event) (interface{}, error) {
	log.Printf("[WebSocket Router] Routing event: RouteKey=%s, ConnectionID=%s", event.RouteKey, event.ConnectionID)

	handler, exists := r.handlers[event.RouteKey]
	if !exists {
		// Fallback to $default handler if available
		var defaultExists bool
		handler, defaultExists = r.handlers["$default"]
		if !defaultExists {
			return nil, fmt.Errorf("no handler registered for route key: %s", event.RouteKey)
		}
		log.Printf("[WebSocket Router] No explicit handler for %s, falling back to $default", event.RouteKey)
	}

	return handler(ctx, event)
}
