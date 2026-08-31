/**
 * Cross-tab auth synchronization (#550)
 *
 * Design:
 * - BroadcastChannel('cs-auth') for instant login/logout/refresh events when supported.
 * - window 'storage' events as a fallback (and for older browsers without BroadcastChannel).
 * - localStorage leader lock so only one tab runs proactive token refresh.
 *
 * Message types: login | logout | refresh | profile
 */

export type AuthBroadcastType = 'login' | 'logout' | 'refresh' | 'profile';

export interface AuthBroadcastMessage {
  type: AuthBroadcastType;
  ts: number;
  source: string;
}

export const AUTH_CHANNEL_NAME = 'cs-auth';
export const AUTH_LEADER_KEY = 'cs_auth_leader';
export const AUTH_STORAGE_KEYS = [
  'cs_access_token',
  'cs_refresh_token',
  'cs_user',
] as const;

const TAB_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tab_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const LEADER_TTL_MS = 5000;

export function getTabId(): string {
  return TAB_ID;
}

export function createAuthChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  try {
    return new BroadcastChannel(AUTH_CHANNEL_NAME);
  } catch {
    return null;
  }
}

export function broadcastAuthEvent(
  channel: BroadcastChannel | null,
  type: AuthBroadcastType,
): void {
  const message: AuthBroadcastMessage = {
    type,
    ts: Date.now(),
    source: TAB_ID,
  };
  try {
    channel?.postMessage(message);
  } catch {
    // ignore
  }
  // Also touch a coordination key so storage listeners fire even without BC
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('cs_auth_event', JSON.stringify(message));
      localStorage.removeItem('cs_auth_event');
    } catch {
      // ignore
    }
  }
}

/**
 * Try to become / remain the refresh leader.
 * Returns true if this tab should perform proactive refresh.
 */
export function tryAcquireRefreshLeadership(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const now = Date.now();
    const raw = localStorage.getItem(AUTH_LEADER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { id: string; ts: number };
      if (parsed.id !== TAB_ID && now - parsed.ts < LEADER_TTL_MS) {
        return false;
      }
    }
    localStorage.setItem(
      AUTH_LEADER_KEY,
      JSON.stringify({ id: TAB_ID, ts: now }),
    );
    return true;
  } catch {
    return true;
  }
}

export function isAuthStorageKey(key: string | null): boolean {
  if (!key) return false;
  return (
    AUTH_STORAGE_KEYS.includes(key as (typeof AUTH_STORAGE_KEYS)[number]) ||
    key === 'cs_auth_event'
  );
}
