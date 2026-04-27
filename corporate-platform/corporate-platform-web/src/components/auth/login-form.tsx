'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loginSchema, LoginFormData } from '@/lib/validation-schemas';
import { useAuth } from '@/hooks/use-auth';

export const LoginForm: React.FC = () => {
  const router = useRouter();
  const { login, isLoading: authLoading, error: authError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password);
      reset();
      router.push('/dashboard');
    } catch (error: any) {
      setError('root', {
        type: 'manual',
        message: error.message || 'Login failed. Please check your credentials.',
      });
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-bold text-white">Welcome Back</h1>
        <p className="mb-6 text-sm text-slate-400">
          Sign in to your account to continue
        </p>

        {authError && (
          <div className="mb-4 rounded-lg bg-red-900 p-3 text-sm text-red-200">
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-200">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...register('email')}
              className={`mt-1 w-full rounded-lg border bg-slate-700 px-4 py-2 text-white placeholder-slate-400 transition ${
                errors.email
                  ? 'border-red-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500'
                  : 'border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
              }`}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-200">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                className={`mt-1 w-full rounded-lg border bg-slate-700 px-4 py-2 text-white placeholder-slate-400 transition ${
                  errors.password
                    ? 'border-red-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500'
                    : 'border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
            )}
          </div>

          {/* Error Summary */}
          {errors.root && (
            <div className="rounded-lg bg-red-900 p-3 text-sm text-red-200">
              {errors.root.message}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || authLoading}
            className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 py-2 font-medium text-white transition hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting || authLoading ? 'Signing in...' : 'Sign In'}
          </button>

          {/* Forgot Password Link */}
          <div className="text-center text-sm">
            <Link
              href="/forgot-password"
              className="text-blue-400 hover:text-blue-300 transition"
            >
              Forgot password?
            </Link>
          </div>
        </form>

        {/* Register Link */}
        <div className="mt-6 border-t border-slate-700 pt-6 text-center text-sm">
          <p className="text-slate-400">
            Don't have an account?{' '}
            <Link
              href="/register"
              className="font-medium text-blue-400 hover:text-blue-300 transition"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
