'use client';

import { useState } from 'react';
import type { ReportDefinition } from '@/store/reports.types';
import { Share2, Lock, Users, Globe } from 'lucide-react';

type ReportVisibility = 'private' | 'shared' | 'public';

interface ReportSharingProps {
  report: ReportDefinition;
  onVisibilityChange?: (visibility: ReportVisibility) => void;
  disabled?: boolean;
}

const LABELS: Record<ReportVisibility, string> = {
  private: 'Private',
  shared: 'Shared',
  public: 'Public',
};

const ICONS: Record<ReportVisibility, typeof Lock> = {
  private: Lock,
  shared: Users,
  public: Globe,
};

export default function ReportSharing({ report, onVisibilityChange, disabled }: ReportSharingProps) {
  const [open, setOpen] = useState(false);
  const visibility = report.visibility ?? 'private';
  const Icon = ICONS[visibility];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        disabled={disabled}
        aria-label="Sharing options"
      >
        <Share2 className="w-5 h-5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20 py-1">
            {(['private', 'shared', 'public'] as const).map((v) => {
              const I = ICONS[v];
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    onVisibilityChange?.(v);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${
                    visibility === v ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <I className="w-4 h-4" />
                  {LABELS[v]}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
