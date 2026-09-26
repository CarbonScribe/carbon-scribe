import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CommentThread from './CommentThread';
import { useStore } from '@/lib/store/store';
import { subscribeToComments } from '@/lib/ws/collaborationSocket';
import type { Comment } from '@/lib/store/collaboration/collaboration.types';

class FakeWebSocket {
  static readonly OPEN = 1;
  readyState = FakeWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => this.onclose?.());
  emit(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

const comment: Comment = {
  id: 'comment-1',
  project_id: 'project-1',
  user_id: 'user-2',
  content: 'A teammate joined the conversation',
  mentions: [],
  attachments: [],
  is_resolved: false,
  created_at: '2026-08-28T12:00:00Z',
  updated_at: '2026-08-28T12:00:00Z',
};

describe('CommentThread live updates', () => {
  beforeEach(() => {
    useStore.setState({ comments: [] });
  });

  it('renders a comment received through the project socket without refetching', () => {
    const socket = new FakeWebSocket();
    const unsubscribe = subscribeToComments('project-1', {
      createWebSocket: () => socket as unknown as WebSocket,
      onComment: (receivedComment) => useStore.getState().receiveComment(receivedComment),
    });
    socket.onopen?.();
    act(() => socket.emit({ event: 'comment.created', data: comment }));
    render(<CommentThread comment={comment} />);

    expect(screen.getByText(comment.content)).toBeInTheDocument();
    unsubscribe();
  });

  it('does not render the same optimistic and socket comment twice', () => {
    useStore.getState().receiveComment(comment);
    const socket = new FakeWebSocket();
    const unsubscribe = subscribeToComments('project-1', {
      createWebSocket: () => socket as unknown as WebSocket,
      onComment: (receivedComment) => useStore.getState().receiveComment(receivedComment),
    });
    act(() => socket.emit({ type: 'comment.created', project_id: 'project-1', comment }));
    render(<CommentThread comment={comment} />);

    expect(screen.getAllByText(comment.content)).toHaveLength(1);
    expect(useStore.getState().comments).toHaveLength(1);
    unsubscribe();
  });
});