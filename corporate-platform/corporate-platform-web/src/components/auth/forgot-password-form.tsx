'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { forgotPasswordSchema, ForgotPasswordFormData } from '@/lib/validation-schemas';
import { apiClient } from '@/lib/api-client';

export const ForgotPasswordForm: React.FC = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setApiError(null);
      await apiClient.forgotPassword(data.email);
      setIsSubmitted(true);
      reset();
    } catch (error: any) {
      setApiError(error.message || 'Failed to send reset email. Please try again.');
    }
  };

  if (isSubmitted) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 shadow-xl">
          <div className="mb-4 text-center">
            <div className="mb-3 text-4xl">📧</div>
            <h2 className="text-xl font-bold text-white">Check Your Email</h2>
          </div>
          <p className="mb-6 text-center text-slate-300">
            If an account exists for the email you entered, you'll receive password reset
            instructions shortly.
          </p>
          <p className="text-center text-sm text-slate-400">
            Didn't receive an email?{' '}
            <button
              onClick={() => {
                setIsSubmitted(false);
                setApiError(null);
              }}
              className="text-blue-400 hover:text-blue-300"
            >
              Try again
            </button>
          </p>
          <div className="mt-6 border-t border-slate-700 pt-6 text-center">
            <Link
              href="/login"
              className="text-blue-400 hover:text-blue-300 transition text-sm"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-bold text-white">Reset Password</h1>
        <p className="mb-6 text-sm text-slate-400">
          Enter your email address and we'll send you a link to reset your password.
        </p>

        {apiError && (
          <div className="mb-4 rounded-lg bg-red-900 p-3 text-sm text-red-200">
            {apiError}
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 py-2 font-medium text-white transition hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Sending...' : 'Send Reset Link'}
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
