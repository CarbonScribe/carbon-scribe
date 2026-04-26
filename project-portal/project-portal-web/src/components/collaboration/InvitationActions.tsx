'use client';

import { useState } from 'react';
import { RotateCcw, X, Check, XCircle } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import type { ProjectInvitation } from '@/lib/store/collaboration/collaboration.types';

interface InvitationActionsProps {
  invitation: ProjectInvitation;
  onClose: () => void;
  isOwner?: boolean;
}

export default function InvitationActions({ invitation, onClose, isOwner = false }: InvitationActionsProps) {
  const [showConfirm, setShowConfirm] = useState<'resend' | 'cancel' | null>(null);
  const resendInvitation = useStore((s) => s.resendInvitation);
  const cancelInvitation = useStore((s) => s.cancelInvitation);
  const acceptInvitation = useStore((s) => s.acceptInvitation);
  const declineInvitation = useStore((s) => s.declineInvitation);
  const resending = useStore((s) => s.collaborationLoading.resendInvitation);
  const cancelling = useStore((s) => s.collaborationLoading.cancelInvitation);

  const handleResend = async () => {
    const result = await resendInvitation(invitation.id);
    if (result) {
      setShowConfirm(null);
      onClose();
    }
  };

  const handleCancel = async () => {
    const result = await cancelInvitation(invitation.id);
    if (result) {
      setShowConfirm(null);
      onClose();
    }
  };

  const handleAccept = async () => {
    const result = await acceptInvitation(invitation.id);
    if (result) {
      onClose();
    }
  };

  const handleDecline = async () => {
    const result = await declineInvitation(invitation.id);
    if (result) {
      onClose();
    }
  };

  if (showConfirm === 'resend') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-4 max-w-sm">
          <h3 className="font-semibold text-gray-900 mb-2">Resend invitation?</h3>
          <p className="text-sm text-gray-600 mb-4">
            This will reset the expiration time to 48 hours from now.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowConfirm(null)}
              className="px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleResend}
              disabled={resending}
              className="px-3 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 rounded"
            >
              {resending ? 'Resending...' : 'Resend'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showConfirm === 'cancel') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-4 max-w-sm">
          <h3 className="font-semibold text-gray-900 mb-2">Cancel invitation?</h3>
          <p className="text-sm text-gray-600 mb-4">
            This invitation will be cancelled and cannot be accepted.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowConfirm(null)}
              className="px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded"
            >
              Keep
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400 rounded"
            >
              {cancelling ? 'Cancelling...' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 max-w-sm w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Invitation for {invitation.email}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="space-y-2">
          {/* Manager/Owner actions */}
          {isOwner && (
            <>
              <button
                onClick={() => setShowConfirm('resend')}
                disabled={resending || invitation.resent_count >= 3}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 bg-gray-50 hover:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-gray-50 rounded"
                title={invitation.resent_count >= 3 ? 'Maximum resend limit reached' : undefined}
              >
                <RotateCcw className="w-4 h-4" />
                Resend
              </button>
              <button
                onClick={() => setShowConfirm('cancel')}
                disabled={cancelling}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-red-700 bg-red-50 hover:bg-red-100 disabled:text-gray-400 disabled:hover:bg-red-50 rounded"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </>
          )}

          {/* Invited user actions */}
          <button
            onClick={handleAccept}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded"
          >
            <Check className="w-4 h-4" />
            Accept
          </button>
          <button
            onClick={handleDecline}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 bg-gray-50 hover:bg-gray-100 rounded"
          >
            <XCircle className="w-4 h-4" />
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
