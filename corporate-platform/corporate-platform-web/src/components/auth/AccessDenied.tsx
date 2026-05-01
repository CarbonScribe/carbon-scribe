'use client';

import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface AccessDeniedProps {
  title?: string;
  message?: string;
  backHref?: string;
}

export default function AccessDenied({
  title = 'Access Denied',
  message = 'You do not have sufficient permissions to access this page.',
  backHref = '/',
}: AccessDeniedProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-lg w-full corporate-card p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
          <ShieldAlert className="text-red-600 dark:text-red-400" size={28} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {title}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 corporate-btn-primary px-4 py-2"
        >
          <ArrowLeft size={14} />
          Go back
        </Link>
      </div>
    </div>
  );
}
