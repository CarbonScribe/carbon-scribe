import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  subscribeToComments,
  unsubscribeFromComments,
} from './collaborationSocket';
import type { Comment } from '@/lib/store/collaboration/collaboration.types';

const sockets: MockSocket[] = [];

class MockSocket {
  static readonly OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
    this.onclose?.();
  });

  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
}

const comment: Comment = {
  id: 'comment-1',
  project_id: 'project-123',
  user_id: 'user-1',
  content: 'Live comment',
  mentions: [],
  attachments: [],
  is_resolved: false,
  created_at: '2026-08-28T12:00:00Z',
  updated_at: '2026-08-28T12:00:00Z',
};

describe('collaborationSocket', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sockets.length = 0;
  });

  afterEach(() => {
    unsubscribeFromComments('project-123');
    unsubscribeFromComments('project-456');
    vi.useRealTimers();
  });

  function subscribe(projectId = 'project-123', onComment = vi.fn()) {
    subscribeToComments(projectId, {
      createWebSocket: () => {
        const socket = new MockSocket();
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      onComment,
    });
    return onComment;
  }

  it('reconnects after a drop with exponential backoff and resets after success', () => {
    subscribe();
    sockets[0].open();
    sockets[0].drop();
    vi.advanceTimersByTime(999);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);

    sockets[1].open();
    sockets[1].drop();
    vi.advanceTimersByTime(999);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);
  });

  it('reconnects immediately when a backgrounded tab becomes visible', () => {
    subscribe();
    sockets[0].open();
    sockets[0].drop();

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(sockets).toHaveLength(1);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(sockets).toHaveLength(2);
  });

  it('closes the socket and prevents reconnect after unsubscribe', () => {
    subscribe();
    sockets[0].open();
    unsubscribeFromComments('project-123');

    expect(sockets[0].close).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30_000);
    expect(sockets).toHaveLength(1);
  });
});