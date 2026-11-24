'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, AlertCircle, CheckCircle, Loader2, ArrowRight, ShieldAlert } from 'lucide-react';
import AuthNavigation from '@/components/AuthNavigation';
import { resetPasswordApi } from '@/lib/api/auth.api';

const MIN_PASSWORD_LENGTH = 8;

type FormErrors = { newPassword?: string; confirmPassword?: string };

export default function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'form' | 'success' | 'error'>('form');
  const [serverError, setServerError] = useState<string | null>(null);

  const hasFormErrors = Object.values(formErrors).some((msg) => !!msg);

  const validate = (): FormErrors => {
    const errors: FormErrors = {};
    if (!newPassword) {
      errors.newPassword = 'New password is required';
    } else if (newPassword.length < MIN_PASSWORD_LENGTH) {
      errors.newPassword = `Minimum ${MIN_PASSWORD_LENGTH} characters`;
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password';
    } else if (newPassword && confirmPassword !== newPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    return errors;
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    if (!token) return;

    setIsSubmitting(true);
    try {
      await resetPasswordApi({ token, new_password: newPassword });
      setStatus('success');
    } catch (err: any) {
      const message =
        err?.response?.data?.error || err?.message || 'This reset link is invalid or has expired.';
      setServerError(message);
      setStatus('error');
    } finally {
      setIsSubmitting(false);
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
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Reset your password</h1>
            <p className="text-emerald-100 mt-1">Choose a new password for your account.</p>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-emerald-100">
          {!token ? (
            // Missing token state
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-8 h-8 text-yellow-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Missing reset link</h2>
              <p className="text-gray-600 mb-6" role="alert">
                This link is missing its reset token. Request a new password reset link and open the
                link from that email.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/forgot-password')}
                  className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                >
                  Request a new link
                </button>
                <button
                  onClick={() => router.push('/login')}
                  className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Back to login
                </button>
              </div>
            </div>
          ) : status === 'success' ? (
            // Success state
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Password reset</h2>
              <p className="text-gray-600 mb-6">
                Your password has been reset. You can now sign in with your new password.
              </p>
              <button
                onClick={() => router.replace('/login')}
                className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors inline-flex items-center justify-center gap-2"
              >
                Continue to login
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          ) : status === 'error' ? (
            // Invalid/expired token state
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Link invalid or expired</h2>
              <p className="text-gray-600 mb-6" role="alert">
                {serverError}
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/forgot-password')}
                  className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                >
                  Request a new link
                </button>
                <button
                  onClick={() => router.push('/login')}
                  className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Back to login
                </button>
              </div>
            </div>
          ) : (
            // Form state
            <form onSubmit={onSubmit} className="space-y-4" aria-label="Reset password form">
              {hasFormErrors && (
                <div
                  className="p-3 rounded-lg border text-sm flex items-start gap-2 bg-yellow-50 text-yellow-800 border-yellow-200"
                  role="alert"
                  aria-live="assertive"
                >
                  <AlertCircle className="w-5 h-5 mt-0.5" aria-hidden="true" />
                  <div>
                    <div className="font-medium">Please fix the highlighted fields</div>
                    <div className="opacity-90">Check your new password and confirmation.</div>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="reset-password-new" className="text-sm font-medium text-gray-700">
                  New password <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
                  <input
                    id="reset-password-new"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (formErrors.newPassword) setFormErrors((p) => ({ ...p, newPassword: undefined }));
                    }}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                      formErrors.newPassword ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="••••••••"
                    type="password"
                    autoComplete="new-password"
                    aria-required="true"
                    aria-invalid={!!formErrors.newPassword}
                    aria-describedby={formErrors.newPassword ? 'reset-password-new-error' : undefined}
                  />
                </div>
                {formErrors.newPassword && (
                  <p id="reset-password-new-error" className="mt-1 text-sm text-red-600" role="alert">
                    {formErrors.newPassword}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="reset-password-confirm" className="text-sm font-medium text-gray-700">
                  Confirm new password <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
                  <input
                    id="reset-password-confirm"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (formErrors.confirmPassword) setFormErrors((p) => ({ ...p, confirmPassword: undefined }));
                    }}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                      formErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="••••••••"
                    type="password"
                    autoComplete="new-password"
                    aria-required="true"
                    aria-invalid={!!formErrors.confirmPassword}
                    aria-describedby={formErrors.confirmPassword ? 'reset-password-confirm-error' : undefined}
                  />
                </div>
                {formErrors.confirmPassword && (
                  <p id="reset-password-confirm-error" className="mt-1 text-sm text-red-600" role="alert">
                    {formErrors.confirmPassword}
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
                {isSubmitting ? 'Resetting...' : 'Reset password'}
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
