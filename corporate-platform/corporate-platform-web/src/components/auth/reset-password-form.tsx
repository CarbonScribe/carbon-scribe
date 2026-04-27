'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  resetPasswordSchema,
  ResetPasswordFormData,
} from '@/lib/validation-schemas';
import { apiClient } from '@/lib/api-client';

export const ResetPasswordForm: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: token || '',
    },
  });

  if (!token) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 shadow-xl">
          <h2 className="mb-2 text-xl font-bold text-white">Invalid Link</h2>
          <p className="mb-6 text-slate-300">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 text-white transition hover:from-blue-700 hover:to-blue-800"
          >
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      setApiError(null);
      await apiClient.resetPassword(token, data.newPassword);
      setIsSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error: any) {
      setError('root', {
        type: 'manual',
        message: error.message || 'Failed to reset password. Please try again.',
      });
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 shadow-xl">
          <div className="mb-4 text-center">
            <div className="mb-3 text-4xl">✅</div>
            <h2 className="text-xl font-bold text-white">Password Reset</h2>
          </div>
          <p className="mb-6 text-center text-slate-300">
            Your password has been successfully reset. You'll be redirected to sign in shortly.
          </p>
          <Link
            href="/login"
            className="block rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 text-center text-white transition hover:from-blue-700 hover:to-blue-800"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-bold text-white">Set New Password</h1>
        <p className="mb-6 text-sm text-slate-400">
          Enter your new password below.
        </p>

        {apiError && (
          <div className="mb-4 rounded-lg bg-red-900 p-3 text-sm text-red-200">
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Password Field */}
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-slate-200">
              New Password
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('newPassword')}
                className={`mt-1 w-full rounded-lg border bg-slate-700 px-4 py-2 text-white placeholder-slate-400 transition ${
                  errors.newPassword
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
            {errors.newPassword && (
              <p className="mt-1 text-xs text-red-400">{errors.newPassword.message}</p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Must contain uppercase, lowercase, number, and special character (min 8 chars)
            </p>
          </div>

          {/* Confirm Password Field */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-200">
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('confirmPassword')}
                className={`mt-1 w-full rounded-lg border bg-slate-700 px-4 py-2 text-white placeholder-slate-400 transition ${
                  errors.confirmPassword
                    ? 'border-red-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500'
                    : 'border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showConfirmPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-400">{errors.confirmPassword.message}</p>
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
            disabled={isSubmitting}
            className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 py-2 font-medium text-white transition hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        {/* Back to Login */}
        <div className="mt-6 border-t border-slate-700 pt-6 text-center text-sm">
          <Link
            href="/login"
            className="text-blue-400 hover:text-blue-300 transition"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
};
