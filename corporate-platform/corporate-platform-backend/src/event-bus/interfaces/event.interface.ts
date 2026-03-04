export interface Event<T = any> {
  id: string; // Unique event ID
  type: string; // Event type (e.g., 'credit.purchased')
  source: string; // Service name
  timestamp: string; // ISO timestamp
  correlationId: string; // For tracing
  userId?: string; // User who triggered event
  companyId?: string; // Tenant context
  data: T; // Event payload
  version: string; // Schema version
}
