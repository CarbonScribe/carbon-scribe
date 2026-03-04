'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store/store';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface Props {
    alertId: string;
}

export default function AcknowledgeAlertButton({ alertId }: Props) {
    const acknowledgeAlert = useStore((state) => state.acknowledgeAlert);
    const user = useStore((state) => state.user);
    const [isPending, setIsPending] = useState(false);

    const handleAcknowledge = async (e: React.MouseEvent) => {
        e.stopPropagation();

        if (!user) {
            alert("You must be logged in to acknowledge alerts.");
            return;
        }

        if (user.role !== 'admin') {
            alert("Only administrators can acknowledge system alerts.");
            return;
        }

        setIsPending(true);
        try {
            await acknowledgeAlert(alertId, user.id);
        } catch (error) {
            console.error(error);
            alert("Failed to acknowledge alert");
        } finally {
            setIsPending(false);
        }
    };

    return (
        <button
            onClick={handleAcknowledge}
            disabled={isPending}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
        ${isPending
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-blue-600'
                }
      `}
        >
            {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                <CheckCircle2 className="w-4 h-4" />
            )}
            {isPending ? 'Acknowledging...' : 'Acknowledge'}
        </button>
    );
}
