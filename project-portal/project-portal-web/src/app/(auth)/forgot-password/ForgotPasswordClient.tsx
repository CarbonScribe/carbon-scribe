'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, AlertCircle, CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import AuthNavigation from '@/components/AuthNavigation';
import { requestPasswordResetApi } from '@/lib/api/auth.api';

const NEUTRAL_MESSAGE = 'If the email exists, a reset link has been sent.';

export default function ForgotPasswordClient() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validate = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return 'Email is required';
    if (!emailRegex.test(email)) return 'Invalid email address';
    return undefined;
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const error = validate();
    if (error) {
      setEmailError(error);
      return;
    }
    setEmailError(undefined);
    setIsSubmitting(true);

    // Always land on the same neutral message, whether the request
    // succeeds, fails, or the email simply doesn't exist (#800) — the
    // backend already returns an identical success response either way,
    // and the frontend never surfaces a different outcome that could let
    // someone enumerate which emails have accounts.
    try {
      await requestPasswordResetApi(email);
    } catch (err) {
      console.error('Password reset request failed:', err);
    } finally {
      setIsSubmitting(false);
      setSubmitted(true);
    }
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
            <h1 className="text-2xl font-bold">Forgot your password?</h1>
            <p className="text-emerald-100 mt-1">
              Enter the email on your account and we&apos;ll send you a reset link.
            </p>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-emerald-100">
          {submitted ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
              <p className="text-gray-600 mb-6" role="status">
                {NEUTRAL_MESSAGE}
              </p>
              <button
                onClick={() => router.replace('/login')}
                className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors inline-flex items-center justify-center gap-2"
              >
                Return to Login
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" aria-label="Forgot password form">
              {emailError && (
                <div
                  className="p-3 rounded-lg border text-sm flex items-start gap-2 bg-yellow-50 text-yellow-800 border-yellow-200"
                  role="alert"
                  aria-live="assertive"
                >
                  <AlertCircle className="w-5 h-5 mt-0.5" aria-hidden="true" />
                  <div>
                    <div className="font-medium">Please fix the highlighted field</div>
                    <div className="opacity-90">{emailError}</div>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="forgot-password-email" className="text-sm font-medium text-gray-700">
                  Email <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
                  <input
                    id="forgot-password-email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError(undefined);
                    }}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                      emailError ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="you@domain.com"
                    type="email"
                    autoComplete="email"
                    aria-required="true"
                    aria-invalid={!!emailError}
                    aria-describedby={emailError ? 'forgot-password-email-error' : undefined}
                  />
                </div>
                {emailError && (
                  <p id="forgot-password-email-error" className="mt-1 text-sm text-red-600" role="alert">
                    {emailError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
                aria-busy={isSubmitting}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                {isSubmitting ? 'Sending...' : 'Send reset link'}
              </button>

              <button
                type="button"
                onClick={() => router.push('/login')}
                className="w-full text-center text-sm font-medium text-emerald-600 hover:text-emerald-700"
              >
                Back to login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
