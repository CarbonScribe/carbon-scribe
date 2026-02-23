'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store/store';
import { Mail, Lock, ChevronRight, AlertCircle, Loader2, User } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export default function RegisterClient() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';

  // Store actions/state
  const register = useStore((s) => s.register);
  const serverError = useStore((s) => s.authError);
  const loading = useStore((s) => s.authLoading.register);
  const clearError = useStore((s) => s.clearError);

  // Form State
  const [full_name, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formErrors, setFormErrors] = useState<{ full_name?: string; email?: string; password?: string }>({});

  const hasFormErrors = Object.values(formErrors).some((msg) => !!msg);

  const validate = () => {
    const errors: { full_name?: string; email?: string; password?: string } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!full_name) {
      errors.full_name = 'Full name is required';
    }


    if (!email) {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(email)) {
      errors.email = 'Invalid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Minimum 6 characters';
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
      await register({full_name, email, password});
      showToast('success', 'Account created successfully');
      router.replace(next);
    } catch (err: any) {
      console.error('Register submission error:', err);
      showToast('error', err?.message ?? 'Registration failed');
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-linear-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Welcome to Carbon Scribe</h1>
            <p className="text-emerald-100">Sign up to create and manage your carbon projects</p>
          </div>
          <button
            onClick={() => router.push('/login')}
            className="mt-4 md:mt-0 px-6 py-3 bg-white text-emerald-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors flex items-center"
          >
            <span>Already have an account? Sign in</span>
            <ChevronRight className="w-5 h-5 ml-2" />
          </button>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 max-w-lg mx-auto">
        {(hasFormErrors || serverError) && (
          <div
            className={`mb-4 p-3 rounded-lg border text-sm flex items-start gap-2 ${
              serverError
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-yellow-50 text-yellow-800 border-yellow-200'
            }`}
          >
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <div>
              <div className="font-medium">
                {serverError ? 'Sign up failed' : 'Please fix the highlighted fields'}
              </div>
              <div className="opacity-90">
                {serverError || 'Check your name, email and password and try again.'}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4 text-black">
          <div>
            <label className="text-sm font-medium text-gray-700">Full Name</label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                value={full_name}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (formErrors.full_name) setFormErrors((p) => ({ ...p, full_name: undefined }));
                }}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                  formErrors.full_name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="John Doe"
                type="text"
                autoComplete="name"
              />
            </div>
            {formErrors.full_name && <p className="mt-1 text-sm text-red-600">{formErrors.full_name}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Email</label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
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
              />
            </div>
            {formErrors.email && <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Password</label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
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
              />
            </div>
            {formErrors.password && <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
}
