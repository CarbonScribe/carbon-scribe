'use client';

import { useEffect } from 'react';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import { useRootComments } from '@/lib/store/collaboration/collaboration.selectors';
import CommentForm from './CommentForm';
import CommentThread from './CommentThread';

interface CommentSectionProps {
  projectId: string;
}

export default function CommentSection({ projectId }: CommentSectionProps) {
  const fetchComments = useStore((s) => s.fetchComments);
  const loading = useStore((s) => s.collaborationLoading.comments);
  const rootComments = useRootComments();

  useEffect(() => {
    fetchComments(projectId);
  }, [projectId, fetchComments]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-emerald-600" />
        Comments
      </h3>
      <CommentForm projectId={projectId} />
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
      ) : rootComments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>No comments yet. Start the conversation.</p>
        </div>
      ) : (
        <div className="space-y-2 divide-y divide-gray-100">
          {rootComments.map((c) => (
            <CommentThread key={c.id} comment={c} />
          ))}
        </div>
      )}
    </div>
  );
}
