'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, X, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import { requestPasswordResetApi } from '@/lib/api/auth.api';
import { showToast } from '@/components/ui/Toast';

interface EmailVerificationBannerProps {
  className?: string;
}

export default function EmailVerificationBanner({ className = '' }: EmailVerificationBannerProps) {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const [isResending, setIsResending] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Don't show if user is verified, no user, or dismissed
  if (!user || user.email_verified || isDismissed) return null;

  const handleResendVerification = async () => {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setError(null);

    try {
      await requestPasswordResetApi(user.email);
      showToast('success', 'Verification email sent! Please check your inbox.');
      setResendCooldown(60);
      
      // Start cooldown timer
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Failed to resend verification email';
      setError(message);
      showToast('error', message);
    } finally {
      setIsResending(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  const handleVerifyNow = () => {
    router.push(`/verify-email-prompt?email=${encodeURIComponent(user.email)}`);
  };

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4 ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
            <Mail className="w-5 h-5 text-amber-600" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-amber-800">Verify Your Email</h4>
          <p className="text-sm text-amber-700 mt-0.5">
            Please verify your email address to access all features and receive important notifications.
          </p>
          
          {error && (
            <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button
              onClick={handleVerifyNow}
              className="px-4 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
            >
              Verify Now
            </button>
            <button
              onClick={handleResendVerification}
              disabled={isResending || resendCooldown > 0}
              className="px-4 py-1.5 bg-white text-amber-700 text-sm font-medium rounded-lg border border-amber-300 hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              {isResending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  Sending...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Email'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-amber-200/50 transition-colors"
          aria-label="Dismiss verification reminder"
        >
          <X className="w-4 h-4 text-amber-600" />
        </button>
      </div>
    </div>
  );
}