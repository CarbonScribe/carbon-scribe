import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CommentSection from './CommentSection';
import { useStore } from '@/lib/store/store';
import type { Comment } from '@/lib/store/collaboration/collaboration.types';
import { subscribeToComments, unsubscribeFromComments } from '@/lib/ws/collaborationSocket';

const handlersByProject = new Map<string, ((comment: Comment) => void)[]>();

vi.mock('@/lib/ws/collaborationSocket', () => ({
  subscribeToComments: vi.fn((projectId: string, options: { onComment: (comment: Comment) => void }) => {
    const handlers = handlersByProject.get(projectId) ?? [];
    handlers.push(options.onComment);
    handlersByProject.set(projectId, handlers);
  }),
  unsubscribeFromComments: vi.fn((projectId: string) => {
    handlersByProject.delete(projectId);
  }),
}));

const comment = (id: string, projectId: string, content: string): Comment => ({
  id,
  project_id: projectId,
  user_id: 'user-2',
  content,
  mentions: [],
  attachments: [],
  is_resolved: false,
  created_at: '2026-08-28T12:00:00Z',
  updated_at: '2026-08-28T12:00:00Z',
});

function emitCommentCreated(projectId: string, value: Comment) {
  handlersByProject.get(projectId)?.forEach((handler) => handler(value));
}

describe('CommentSection live subscription integration', () => {
  beforeEach(() => {
    handlersByProject.clear();
    vi.clearAllMocks();
    useStore.setState({ comments: [] });
  });

  afterEach(() => cleanup());

  it('subscribes with the projectId and renders an incoming comment', async () => {
    render(<CommentSection projectId="project-abc" />);
    expect(subscribeToComments).toHaveBeenCalledWith('project-abc', expect.objectContaining({ onComment: expect.any(Function) }));

    act(() => emitCommentCreated('project-abc', comment('c-1', 'project-abc', 'This arrived via WebSocket')));
    await waitFor(() => expect(screen.getByText('This arrived via WebSocket')).toBeInTheDocument());
  });

  it('ignores events for another project and de-duplicates by comment id', async () => {
    render(<CommentSection projectId="project-abc" />);
    act(() => emitCommentCreated('project-other', comment('c-2', 'project-other', 'Should not appear here')));
    expect(screen.queryByText('Should not appear here')).not.toBeInTheDocument();

    const duplicate = comment('c-3', 'project-abc', 'Duplicate check');
    act(() => {
      emitCommentCreated('project-abc', duplicate);
      emitCommentCreated('project-abc', duplicate);
    });
    await waitFor(() => expect(screen.getAllByText('Duplicate check')).toHaveLength(1));
    expect(useStore.getState().comments).toHaveLength(1);
  });

  it('unsubscribes on unmount and resubscribes when the project changes', () => {
    const { rerender, unmount } = render(<CommentSection projectId="project-abc" />);
    rerender(<CommentSection projectId="project-xyz" />);
    expect(unsubscribeFromComments).toHaveBeenCalledWith('project-abc');
    expect(subscribeToComments).toHaveBeenCalledWith('project-xyz', expect.anything());
    unmount();
    expect(unsubscribeFromComments).toHaveBeenCalledWith('project-xyz');
  });
});