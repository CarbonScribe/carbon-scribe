import { Suspense } from 'react';
import ForgotPasswordClient from './ForgotPasswordClient';

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <ForgotPasswordClient />
    </Suspense>
  );
}
