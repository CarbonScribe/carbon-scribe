'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store/store';
import { Mail, Lock, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import AuthNavigation from '@/components/AuthNavigation';

export default function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';

  // Store actions/state
  const login = useStore((s) => s.login);
  const serverError = useStore((s) => s.authError);
  const loading = useStore((s) => s.authLoading.login);
  const isHydrated = useStore((s) => s.isHydrated);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const clearError = useStore((s) => s.clearError);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string }>({});

  const hasFormErrors = Object.values(formErrors).some((msg) => !!msg);

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      router.replace(next);
    }
  }, [isHydrated, isAuthenticated, router, next]);

  const validate = () => {
    const errors: { email?: string; password?: string } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(email)) {
      errors.email = 'Invalid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    }

    return errors;
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    setFormErrors({});
    clearError();

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      await login(email, password);
      showToast('success', 'Signed in successfully');
      router.replace(next);
    } catch (err: any) {
      console.error('Login submission error:', err);
      showToast('error', err?.response?.data?.error || err?.message || 'Login failed');
    }
  }

  return (
    <div className="relative space-y-6 animate-fadeIn">
      <div className="pointer-events-none absolute -z-10 inset-0 overflow-hidden rounded-3xl">
        <div className="absolute -top-16 -left-16 h-56 w-56 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute top-10 right-0 h-56 w-56 rounded-full bg-cyan-200/30 blur-3xl" />
      </div>

      <div className="flex justify-end">
        <AuthNavigation />
      </div>

      {/* Header */}
      <div className="bg-linear-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Welcome back</h1>
            <p className="text-emerald-100">Sign in to manage your projects and carbon credits</p>
          </div>
          <button
            onClick={() => router.push('/register')}
            className="mt-4 md:mt-0 px-6 py-3 bg-white text-emerald-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors flex items-center"
          >
            <span>Create Account</span>
            <ChevronRight className="w-5 h-5 ml-2" />
          </button>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-emerald-100 max-w-lg mx-auto">
        {(hasFormErrors || serverError) && (
          <div
            className={`mb-4 p-3 rounded-lg border text-sm flex items-start gap-2 ${
              serverError
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-yellow-50 text-yellow-800 border-yellow-200'
            }`}
            role="alert"
            aria-live="assertive"
          >
            <AlertCircle className="w-5 h-5 mt-0.5" aria-hidden="true" />
            <div>
              <div className="font-medium">
                {serverError ? 'Sign in failed' : 'Please fix the highlighted fields'}
              </div>
              <div className="opacity-90">
                {serverError || 'Check your email and password and try again.'}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4 text-black" aria-label="Login form">
          <div>
            <label htmlFor="login-email" className="text-sm font-medium text-gray-700">
              Email
            </label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
              <input
                id="login-email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (formErrors.email) setFormErrors((p) => ({ ...p, email: undefined }));
                }}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                  formErrors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="you@domain.com"
                type="email"
                autoComplete="email"
                aria-required="true"
                aria-invalid={!!formErrors.email}
                aria-describedby={formErrors.email ? 'login-email-error' : undefined}
              />
            </div>
            {formErrors.email && (
              <p id="login-email-error" className="mt-1 text-sm text-red-600" role="alert">
                {formErrors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="login-password" className="text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
              <input
                id="login-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (formErrors.password) setFormErrors((p) => ({ ...p, password: undefined }));
                }}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                  formErrors.password ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="••••••••"
                type="password"
                autoComplete="current-password"
                aria-required="true"
                aria-invalid={!!formErrors.password}
                aria-describedby={formErrors.password ? 'login-password-error' : undefined}
              />
            </div>
            {formErrors.password && (
              <p id="login-password-error" className="mt-1 text-sm text-red-600" role="alert">
                {formErrors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
            aria-busy={loading}
          >
            {loading && (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            )}
            {loading ? 'Signing in…' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
