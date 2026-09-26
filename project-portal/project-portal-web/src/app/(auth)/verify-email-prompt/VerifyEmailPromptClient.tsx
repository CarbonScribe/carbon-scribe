'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, RefreshCw, CheckCircle, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import { verifyEmailApi } from '@/lib/api/auth.api';
import { showToast } from '@/components/ui/Toast';
import AuthNavigation from '@/components/AuthNavigation';

export default function VerifyEmailPromptClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const user = useStore((s) => s.user);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const isHydrated = useStore((s) => s.isHydrated);

  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'error' | 'expired'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [emailToVerify, setEmailToVerify] = useState<string>('');

  useEffect(() => {
    // Get email from user or from URL param
    if (user?.email) {
      setEmailToVerify(user.email);
    } else if (email) {
      setEmailToVerify(email);
    }
  }, [user, email]);

  // Auto-verify if token is present in URL
  useEffect(() => {
    if (token && !isVerifying && verificationStatus === 'idle') {
      handleVerifyEmail(token);
    }
  }, [token]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Redirect if already verified
  useEffect(() => {
    if (isHydrated && user?.email_verified) {
      router.replace('/');
    }
  }, [isHydrated, user, router]);

  const handleVerifyEmail = async (verificationToken: string) => {
    setIsVerifying(true);
    setVerificationStatus('verifying');
    setErrorMessage(null);

    try {
      await verifyEmailApi(verificationToken);
      setVerificationStatus('success');
      showToast('success', 'Email verified successfully!');
      
      // Refresh user profile to update email_verified status
      const fetchProfile = useStore.getState().fetchProfile;
      await fetchProfile();
      
      // Redirect after short delay
      setTimeout(() => {
        router.replace('/');
      }, 2000);
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Verification failed';
      setErrorMessage(message);
      
      // Check if token is expired
      if (error?.response?.status === 400 || message.includes('expired')) {
        setVerificationStatus('expired');
        showToast('error', 'Verification link has expired. Please request a new one.');
      } else {
        setVerificationStatus('error');
        showToast('error', message);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    if (!emailToVerify) {
      showToast('error', 'No email address found. Please try again.');
      return;
    }

    setIsResending(true);
    setErrorMessage(null);

    try {
      // Use the existing requestPasswordResetApi as a resend mechanism
      const { requestPasswordResetApi } = await import('@/lib/api/auth.api');
      await requestPasswordResetApi(emailToVerify);
      
      showToast('success', 'Verification email sent! Please check your inbox.');
      setResendCooldown(60);
      setVerificationStatus('idle');
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Failed to resend verification email';
      setErrorMessage(message);
      showToast('error', message);
    } finally {
      setIsResending(false);
    }
  };

  const handleContinueToLogin = () => {
    router.replace('/login');
  };

  // Loading state
  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
          <p className="mt-3 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
      <div className="relative w-full max-w-md space-y-6 animate-fadeIn">
        <div className="pointer-events-none absolute -z-10 inset-0 overflow-hidden rounded-3xl">
          <div className="absolute -top-16 -left-16 h-56 w-56 rounded-full bg-emerald-200/30 blur-3xl" />
          <div className="absolute top-10 right-0 h-56 w-56 rounded-full bg-cyan-200/30 blur-3xl" />
        </div>

        <div className="flex justify-end">
          <AuthNavigation />
        </div>

        {/* Header */}
        <div className="bg-linear-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Verify Your Email</h1>
            <p className="text-emerald-100 mt-1">Please verify your email address to continue</p>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-emerald-100">
          {verificationStatus === 'success' ? (
            // Success State
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Email Verified!</h2>
              <p className="text-gray-600 mb-6">
                Your email has been successfully verified. You can now access all features.
              </p>
              <button
                onClick={handleContinueToLogin}
                className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors inline-flex items-center justify-center gap-2"
              >
                Continue to Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : verificationStatus === 'verifying' ? (
            // Verifying State
            <div className="text-center py-6">
              <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Verifying Your Email</h2>
              <p className="text-gray-600">Please wait while we confirm your email address...</p>
            </div>
          ) : (
            <>
              {/* Instructions */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Check Your Inbox</h2>
                <p className="text-gray-600">
                  We've sent a verification link to{' '}
                  <span className="font-medium text-gray-900">{emailToVerify || 'your email'}</span>
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Click the link in the email to verify your account.
                </p>
              </div>

              {/* Error Message */}
              {(errorMessage || verificationStatus === 'expired') && (
                <div
                  className={`mb-4 p-3 rounded-lg border text-sm flex items-start gap-2 ${
                    verificationStatus === 'expired'
                      ? 'bg-yellow-50 text-yellow-800 border-yellow-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                  role="alert"
                  aria-live="assertive"
                >
                  <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <div className="font-medium">
                      {verificationStatus === 'expired' ? 'Link Expired' : 'Verification Failed'}
                    </div>
                    <div className="opacity-90">
                      {errorMessage || 'The verification link has expired. Please request a new one.'}
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3">
                {verificationStatus === 'expired' && (
                  <button
                    onClick={handleResendVerification}
                    disabled={isResending || resendCooldown > 0}
                    className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    {isResending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" aria-hidden="true" />
                        {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Verification Email'}
                      </>
                    )}
                  </button>
                )}

                {verificationStatus === 'idle' && (
                  <button
                    onClick={handleResendVerification}
                    disabled={isResending || resendCooldown > 0}
                    className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    {isResending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" aria-hidden="true" />
                        {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Verification Email'}
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={() => router.replace('/login')}
                  className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors inline-flex items-center justify-center gap-2"
                >
                  Return to Login
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Help Text */}
              <p className="text-xs text-gray-500 mt-4 text-center">
                Didn't receive the email? Check your spam folder or request a new link.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}