import { Suspense } from 'react';
import VerifyEmailClient from './VerifyEmailClient';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <VerifyEmailClient />
    </Suspense>
  );
}
