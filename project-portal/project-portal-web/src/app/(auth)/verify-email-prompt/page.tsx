import { Suspense } from 'react';
import VerifyEmailPromptClient from './VerifyEmailPromptClient';

export default function VerifyEmailPromptPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <VerifyEmailPromptClient />
    </Suspense>
  );
}