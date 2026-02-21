'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/store/store';

export default function RegisterPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';

  const register = useStore((s) => s.register);
  const serverError = useStore((s) => s.error);
  const loading = useStore((s) => s.loading.register);
  const clearError = useStore((s) => s.clearError);

  const [formErrors, setFormErrors] = useState<{
    full_name?: string;
    email?: string;
    password?: string;
  }>({});
  
  const [full_name, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const hasFormErrors = Object.values(formErrors).some((msg) => !!msg);

  const validate = () => {
    const errors: { full_name?: string; email?: string; password?: string } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!full_name.trim()) errors.full_name = 'Full name is required';
    else if (full_name.length < 2) {
      errors.full_name = 'Full name must be at least 2 characters';
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
      router.replace(next);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center text-black">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
        <h1 className="text-2xl font-bold">Register</h1>
        <p className="text-gray-600 mt-1">Create a new account.</p>

        {/* Validation Error Banner */}
        {hasFormErrors && (
          <div className="mt-4 p-3 rounded-lg bg-yellow-50 text-yellow-800 border border-yellow-200 text-sm">
            Please fix the highlighted fields below.
          </div>
        )}

        {/* Server/API Error Banner */}
        {serverError && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Full Name</label>
            <input
              value={full_name}
              onChange={(e) => {
                setFullName(e.target.value)
                if (formErrors.full_name) setFormErrors((prev) => ({ ...prev, full_name: undefined }));
              }}
              className={`mt-1 w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500
                ${formErrors?.full_name ? 'border-red-500' : 'border-gray-300'}
              `}
              placeholder="John Doe"
              type="text"
              autoComplete="name"
            />
            {formErrors.full_name && (
              <p className="mt-1 text-sm text-red-600">{formErrors.full_name}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (formErrors.email) setFormErrors(prev => ({ ...prev, email: undefined }));
              }}
              className={`mt-1 w-full px-3 py-2 border rounded-lg outline-none transition-all focus:ring-2 focus:ring-emerald-500
                ${formErrors.email ? 'border-red-500 bg-red-50' : 'border-gray-300'}
              `}
              placeholder="you@domain.com"
              type="text"
              autoComplete="email"
            />
            {formErrors.email && (
              <p className="mt-1 text-sm text-red-600 animate-in fade-in slide-in-from-top-1">
                {formErrors.email}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Password</label>
            <input
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (formErrors.password) setFormErrors(prev => ({ ...prev, password: undefined }));
              }}
              className={`mt-1 w-full px-3 py-2 border rounded-lg outline-none transition-all focus:ring-2 focus:ring-emerald-500
                ${formErrors.password ? 'border-red-500 bg-red-50' : 'border-gray-300'}
              `}
              placeholder="••••••••"
              type="password"
              autoComplete="current-password"
            />
            {formErrors.password && (
              <p className="mt-1 text-sm text-red-600 animate-in fade-in slide-in-from-top-1">
                {formErrors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? 'Signing up…' : 'Register'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/login')}
            className="w-full py-2 rounded-lg border border-gray-300 text-gray-900 font-medium hover:bg-gray-50"
          >
            Login with existing account
          </button>
        </form>
      </div>
    </div>
  );
}
