import { authApiClient } from '@/lib/api/auth-http';
import type {
  AuditEventResponse,
  AuditEventDetail,
  VerificationResult,
  BatchVerificationResult,
  ChainIntegrityResult,
  AuditQueryParams,
  CreateAuditEventInput,
  AuditEvent,
} from '@/types/audit.types';

const AUDIT_PREFIX = '/api/v1/audit-trail';

/**
 * Query audit events with filters
 */
export async function queryAuditEvents(
  params: AuditQueryParams = {}
): Promise<AuditEventResponse> {
  const queryParams = new URLSearchParams();

  if (params.userId) queryParams.set('userId', params.userId);
  if (params.eventType) queryParams.set('eventType', params.eventType);
  if (params.action) queryParams.set('action', params.action);
  if (params.entityType) queryParams.set('entityType', params.entityType);
  if (params.entityId) queryParams.set('entityId', params.entityId);
  if (params.from) queryParams.set('from', params.from);
  if (params.to) queryParams.set('to', params.to);
  if (params.page) queryParams.set('page', params.page.toString());
  if (params.limit) queryParams.set('limit', params.limit.toString());

  const queryString = queryParams.toString();
  const path = queryString ? `${AUDIT_PREFIX}/events?${queryString}` : `${AUDIT_PREFIX}/events`;

  return authApiClient.get<AuditEventResponse>(path);
}

/**
 * Get a specific audit event by ID
 */
export async function getAuditEvent(eventId: string): Promise<AuditEventDetail> {
  return authApiClient.get<AuditEventDetail>(`${AUDIT_PREFIX}/events/${eventId}`);
}

/**
 * Get audit trail for a specific entity
 */
export async function getEntityAuditTrail(
  entityType: string,
  entityId: string
): Promise<{ events: AuditEvent[] }> {
  return authApiClient.get<{ events: AuditEvent[] }>(
    `${AUDIT_PREFIX}/entity/${entityType}/${entityId}`
  );
}

/**
 * Verify a single audit event's integrity
 */
export async function verifyAuditEvent(eventId: string): Promise<VerificationResult> {
  return authApiClient.get<VerificationResult>(`${AUDIT_PREFIX}/verify/${eventId}`);
}

/**
 * Verify multiple audit events' integrity
 */
export async function verifyBatchAuditEvents(
  eventIds: string[]
): Promise<BatchVerificationResult> {
  return authApiClient.post<BatchVerificationResult>(
    `${AUDIT_PREFIX}/verify/batch`,
    { ids: eventIds }
  );
}

/**
 * Check the entire audit chain integrity
 */
export async function checkChainIntegrity(): Promise<ChainIntegrityResult> {
  return authApiClient.get<ChainIntegrityResult>(`${AUDIT_PREFIX}/chain/integrity`);
}

/**
 * Anchor audit trail to blockchain (Stellar)
 */
export async function anchorAuditTrail(): Promise<{ success: boolean; transactionHash: string }> {
  return authApiClient.post<{ success: boolean; transactionHash: string }>(
    `${AUDIT_PREFIX}/anchor`
  );
}

/**
 * Create a new audit event (manual logging)
 */
export async function createAuditEvent(
  input: CreateAuditEventInput
): Promise<AuditEvent> {
  return authApiClient.post<AuditEvent>(`${AUDIT_PREFIX}/events`, input);
}

/**
 * Export audit events as CSV or JSON
 */
export async function exportAuditEvents(
  params: AuditQueryParams = {}
): Promise<Blob> {
  const queryParams = new URLSearchParams();

  if (params.userId) queryParams.set('userId', params.userId);
  if (params.eventType) queryParams.set('eventType', params.eventType);
  if (params.action) queryParams.set('action', params.action);
  if (params.entityType) queryParams.set('entityType', params.entityType);
  if (params.entityId) queryParams.set('entityId', params.entityId);
  if (params.from) queryParams.set('from', params.from);
  if (params.to) queryParams.set('to', params.to);
  queryParams.set('format', params.format || 'csv');

  const queryString = queryParams.toString();
  const path = queryString ? `${AUDIT_PREFIX}/export?${queryString}` : `${AUDIT_PREFIX}/export`;

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const token = localStorage.getItem('cs_access_token');

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to export audit events');
  }

  return response.blob();
}
