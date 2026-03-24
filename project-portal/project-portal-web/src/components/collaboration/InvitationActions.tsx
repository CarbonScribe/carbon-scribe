'use client';

import { useState } from 'react';
import { RotateCcw, X, Check, CheckCircle2, XCircle } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import { showToast } from '@/components/ui/Toast';
import type { ProjectInvitation } from '@/lib/store/collaboration/collaboration.types';

interface InvitationActionsProps {
  invitation: ProjectInvitation;
  canManage: boolean;
  isInvitedUser?: boolean;
}

export default function InvitationActions({
  invitation,
  canManage,
  isInvitedUser = false,
}: InvitationActionsProps) {
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  const resendInvitation = useStore((s: any) => s.resendInvitation);
  const cancelInvitation = useStore((s: any) => s.cancelInvitation);
  const acceptInvitation = useStore((s: any) => s.acceptInvitation);
  const declineInvitation = useStore((s: any) => s.declineInvitation);

  const resendLoading = useStore((s: any) => s.collaborationLoading.resendInvitation);
  const cancelLoading = useStore((s: any) => s.collaborationLoading.cancelInvitation);
  const acceptLoading = useStore((s: any) => s.collaborationLoading.acceptInvitation);
  const declineLoading = useStore((s: any) => s.collaborationLoading.declineInvitation);

  const handleResend = async () => {
    const success = await resendInvitation(invitation.id);
    if (success) {
      showToast('success', `Invitation resent to ${invitation.email}`);
    } else {
      showToast('error', 'Failed to resend invitation');
    }
    setShowConfirm(null);
  };

  const handleCancel = async () => {
    const success = await cancelInvitation(invitation.id);
    if (success) {
      showToast('success', 'Invitation cancelled');
    } else {
      showToast('error', 'Failed to cancel invitation');
    }
    setShowConfirm(null);
  };

  const handleAccept = async () => {
    const success = await acceptInvitation(invitation.id);
    if (success) {
      showToast('success', 'Invitation accepted');
    } else {
      showToast('error', 'Failed to accept invitation');
    }
    setShowConfirm(null);
  };

  const handleDecline = async () => {
    const success = await declineInvitation(invitation.id);
    if (success) {
      showToast('success', 'Invitation declined');
    } else {
      showToast('error', 'Failed to decline invitation');
    }
    setShowConfirm(null);
  };

  // Only show actions for pending invitations
  if (invitation.status !== 'pending') {
    return (
      <div className="flex items-center gap-2">
        {invitation.status === 'accepted' && (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            Accepted
          </span>
        )}
        {invitation.status === 'declined' && (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-full">
            <XCircle className="w-3 h-3" />
            Declined
          </span>
        )}
        {invitation.status === 'cancelled' && (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-50 rounded-full">
            <X className="w-3 h-3" />
            Cancelled
          </span>
        )}
        {invitation.status === 'expired' && (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-full">
            <X className="w-3 h-3" />
            Expired
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Manager actions */}
      {canManage && (
        <>
          <button
            type="button"
            onClick={() => setShowConfirm('resend')}
            disabled={resendLoading || invitation.resent_count >= 3}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={invitation.resent_count >= 3 ? 'Maximum resends reached' : 'Resend invitation'}
          >
            <RotateCcw className="w-3 h-3" />
            Resend
          </button>

          {showConfirm === 'resend' && (
            <div className="absolute z-50 bg-white rounded-lg shadow-lg p-3 border border-gray-200 text-xs">
              <p className="font-medium mb-2">Resend invitation?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleResend}
                  disabled={resendLoading}
                  className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {resendLoading ? 'Sending...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setShowConfirm(null)}
                  className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowConfirm('cancel')}
            disabled={cancelLoading}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>

          {showConfirm === 'cancel' && (
            <div className="absolute z-50 bg-white rounded-lg shadow-lg p-3 border border-gray-200 text-xs">
              <p className="font-medium mb-2">Cancel invitation?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  disabled={cancelLoading}
                  className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {cancelLoading ? 'Cancelling...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setShowConfirm(null)}
                  className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Invited user actions */}
      {isInvitedUser && (
        <>
          <button
            type="button"
            onClick={() => setShowConfirm('accept')}
            disabled={acceptLoading}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <Check className="w-3 h-3" />
            Accept
          </button>

          {showConfirm === 'accept' && (
            <div className="absolute z-50 bg-white rounded-lg shadow-lg p-3 border border-gray-200 text-xs">
              <p className="font-medium mb-2">Accept invitation?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleAccept}
                  disabled={acceptLoading}
                  className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {acceptLoading ? 'Accepting...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setShowConfirm(null)}
                  className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowConfirm('decline')}
            disabled={declineLoading}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-3 h-3" />
            Decline
          </button>

          {showConfirm === 'decline' && (
            <div className="absolute z-50 bg-white rounded-lg shadow-lg p-3 border border-gray-200 text-xs">
              <p className="font-medium mb-2">Decline invitation?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDecline}
                  disabled={declineLoading}
                  className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {declineLoading ? 'Declining...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setShowConfirm(null)}
                  className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
