'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { verifyEmailApi } from '@/lib/api/auth.api';
import { useStore } from '@/lib/store/store';
import { showToast } from '@/components/ui/Toast';

export default function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired'>('loading');
  const [message, setMessage] = useState<string>('');

  const fetchProfile = useStore((s) => s.fetchProfile);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    const verifyEmail = async () => {
      try {
        await verifyEmailApi(token);
        setStatus('success');
        setMessage('Email verified successfully!');
        showToast('success', 'Email verified successfully!');

        // Refresh user profile
        await fetchProfile();

        // Redirect after delay
        setTimeout(() => {
          router.replace('/');
        }, 3000);
      } catch (error: any) {
        const errorMessage = error?.response?.data?.error || error?.message || 'Verification failed';

        if (error?.response?.status === 400 || errorMessage.includes('expired')) {
          setStatus('expired');
          setMessage('Verification link has expired. Please request a new one.');
        } else {
          setStatus('error');
          setMessage(errorMessage);
        }
        showToast('error', errorMessage);
      }
    };

    verifyEmail();
  }, [token, router, fetchProfile]);

  const handleResend = () => {
    router.replace('/verify-email-prompt');
  };

  const handleContinue = () => {
    router.replace('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Verifying Your Email</h1>
            <p className="text-gray-600">Please wait while we confirm your email address...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Email Verified!</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <p className="text-sm text-gray-500">Redirecting to dashboard...</p>
          </>
        )}

        {(status === 'error' || status === 'expired') && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              {status === 'expired' ? 'Link Expired' : 'Verification Failed'}
            </h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="space-y-3">
              {status === 'expired' && (
                <button
                  onClick={handleResend}
                  className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                >
                  Request New Verification Link
                </button>
              )}
              <button
                onClick={handleContinue}
                className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Return to Login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
