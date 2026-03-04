'use client';

import { useRepliesForComment } from '@/lib/store/collaboration/collaboration.selectors';
import type { Comment } from '@/lib/store/collaboration/collaboration.types';

function formatDate(createdAt: string) {
  return new Date(createdAt).toLocaleString();
}

function CommentBlock({ comment, depth = 0 }: { comment: Comment; depth?: number }) {
  const replies = useRepliesForComment(comment.id);
  const marginLeft = depth > 0 ? 'ml-6 border-l-2 border-gray-100 pl-4' : '';

  return (
    <div className={`py-3 ${marginLeft}`}>
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-medium flex-shrink-0">
          {(comment.user_id ?? '?').slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-gray-900">{comment.user_id}</span>
            <span className="text-gray-500">{formatDate(comment.created_at)}</span>
            {comment.is_resolved && (
              <span className="text-xs text-emerald-600 font-medium">Resolved</span>
            )}
          </div>
          <p className="text-gray-700 mt-0.5 whitespace-pre-wrap">{comment.content}</p>
          {replies.length > 0 && (
            <div className="mt-3 space-y-1">
              {replies.map((r) => (
                <CommentBlock key={r.id} comment={r} depth={depth + 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface CommentThreadProps {
  comment: Comment;
}

export default function CommentThread({ comment }: CommentThreadProps) {
  return <CommentBlock comment={comment} depth={0} />;
}
