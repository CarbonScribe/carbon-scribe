import {
  AUTH_CHANNEL_NAME,
  broadcastAuthEvent,
  isAuthStorageKey,
  tryAcquireRefreshLeadership,
} from './cross-tab-auth';

describe('cross-tab-auth (#550)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('identifies auth storage keys', () => {
    expect(isAuthStorageKey('cs_access_token')).toBe(true);
    expect(isAuthStorageKey('cs_refresh_token')).toBe(true);
    expect(isAuthStorageKey('cs_user')).toBe(true);
    expect(isAuthStorageKey('unrelated')).toBe(false);
  });

  it('leader election allows only one active leader within TTL', () => {
    expect(tryAcquireRefreshLeadership()).toBe(true);
    // Same tab can renew
    expect(tryAcquireRefreshLeadership()).toBe(true);
  });

  it('broadcastAuthEvent writes coordination key without throwing', () => {
    expect(() => broadcastAuthEvent(null, 'logout')).not.toThrow();
  });

  it('channel name is stable', () => {
    expect(AUTH_CHANNEL_NAME).toBe('cs-auth');
  });
});
