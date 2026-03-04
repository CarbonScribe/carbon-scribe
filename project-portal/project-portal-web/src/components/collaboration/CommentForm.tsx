'use client';

import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import { showToast } from '@/components/ui/Toast';
import { getCurrentUserId } from '@/lib/auth';

interface CommentFormProps {
  projectId: string;
  parentId?: string | null;
  resourceId?: string | null;
  onSuccess?: () => void;
  placeholder?: string;
}

export default function CommentForm({
  projectId,
  parentId = null,
  resourceId = null,
  onSuccess,
  placeholder = 'Write a comment...',
}: CommentFormProps) {
  const [content, setContent] = useState('');
  const createComment = useStore((s) => s.createComment);
  const loading = useStore((s) => s.collaborationLoading.createComment);

  const userId = getCurrentUserId();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !userId) {
      if (!userId) showToast('error', 'You must be signed in to comment.');
      return;
    }
    const comment = await createComment({
      project_id: projectId,
      user_id: userId,
      content: content.trim(),
      parent_id: parentId ?? undefined,
      resource_id: resourceId ?? undefined,
    });
    if (comment) {
      setContent('');
      showToast('success', 'Comment added.');
      onSuccess?.();
    } else {
      showToast('error', 'Failed to add comment.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
        disabled={loading}
      />
      <button
        type="submit"
        disabled={loading || !content.trim()}
        className="self-end px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Send
      </button>
    </form>
  );
}
