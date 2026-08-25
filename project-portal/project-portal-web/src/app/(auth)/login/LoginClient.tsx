'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, ChevronRight, AlertCircle, Loader2, Eye, EyeOff, Shield, Wallet } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import { showToast } from '@/components/ui/Toast';
import AuthNavigation from '@/components/AuthNavigation';
import { walletChallengeApi } from '@/lib/api/auth.api';
import { isWalletInstalled } from '@/lib/stellar/wallet';

export default function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';

  const login = useStore((s) => s.login);
  const loginWithWallet = useStore((s) => s.loginWithWallet);
  const connectWallet = useStore((s) => s.connectWallet);
  const disconnectWallet = useStore((s) => s.disconnectWallet);
  const wallet = useStore((s) => s.wallet);
  const serverError = useStore((s) => s.authError);
  const loading = useStore((s) => s.authLoading.login);
  const isHydrated = useStore((s) => s.isHydrated);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const user = useStore((s) => s.user);
  const clearError = useStore((s) => s.clearError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string }>({});
  const [emailVerificationError, setEmailVerificationError] = useState<string | null>(null);
  const [walletExtensionInstalled, setWalletExtensionInstalled] = useState<boolean | null>(null);
  const [walletSigning, setWalletSigning] = useState(false);

  const hasFormErrors = Object.values(formErrors).some((msg) => !!msg);

  useEffect(() => {
    isWalletInstalled().then(setWalletExtensionInstalled);
  }, []);

  useEffect(() => {
    if (isHydrated && isAuthenticated && user?.email_verified) {
      router.replace(next);
    }
  }, [isHydrated, isAuthenticated, user, router, next]);

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
    setEmailVerificationError(null);
    clearError();

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      await login(email, password);
      
      const currentUser = useStore.getState().user;
      if (currentUser && !currentUser.email_verified) {
        setEmailVerificationError(
          'Please verify your email address before accessing the portal. A verification link was sent to your email.'
        );
        showToast(
          'error',
          'Email not verified. Please check your inbox for the verification link. You can request a new verification email if needed.'
        );
        return;
      }
      
      router.replace(next);
    } catch (err: any) {
      console.error('Login error:', err);
      
      if (err?.response?.data?.error?.includes('verify') || err?.response?.data?.verification_required) {
        setEmailVerificationError(
          'Your email is not verified. Please check your inbox for the verification link or request a new one.'
        );
        showToast(
          'error',
          'Email not verified. Please verify your email to continue. Check your inbox for the verification link.'
        );
      } else {
        showToast('error', err?.response?.data?.error || err?.message || 'Login failed');
      }
    }
  }

  async function onConnectWallet() {
    clearError();
    setEmailVerificationError(null);

    await connectWallet();

    const latestWallet = useStore.getState().wallet;
    if (latestWallet.connectionState === 'error' || !latestWallet.publicKey) {
      return;
    }

    setWalletSigning(true);
    try {
      const { challenge } = await walletChallengeApi(latestWallet.publicKey);

      const freighterApi = await import('@stellar/freighter-api');
      const signedXdr = await freighterApi.signTransaction(challenge, {
        networkPassphrase: 'Test SDF Network ; September 2015',
      });

      await loginWithWallet(latestWallet.publicKey, signedXdr);
      router.replace(next);
    } catch (err: any) {
      console.error('Wallet login error:', err);
      showToast('error', err?.message || 'Wallet login failed');
    } finally {
      setWalletSigning(false);
    }
  }

  const handleResendVerification = async () => {
    try {
      const { requestPasswordResetApi } = await import('@/lib/api/auth.api');
      await requestPasswordResetApi(email);
      showToast('success', 'Verification email sent! Please check your inbox.');
      setEmailVerificationError(null);
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Failed to resend verification email';
      showToast('error', message);
    }
  };

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
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Welcome Back</h1>
            <p className="text-emerald-100">Sign in to your Carbon Scribe account</p>
          </div>
          <Link
            href="/register"
            className="mt-4 md:mt-0 px-6 py-3 bg-white text-emerald-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors flex items-center"
          >
            <span>Create an account</span>
            <ChevronRight className="w-5 h-5 ml-2" />
          </Link>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-emerald-100 max-w-lg mx-auto">
        {/* Email Verification Error Banner */}
        {emailVerificationError && (
          <div
            className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" aria-hidden="true" />
              <div className="flex-1">
                <div className="font-medium text-yellow-800">Email Verification Required</div>
                <p className="text-sm text-yellow-700 mt-1">{emailVerificationError}</p>
                <button
                  onClick={handleResendVerification}
                  className="mt-2 text-sm font-medium text-yellow-800 underline hover:text-yellow-900"
                >
                  Resend verification email
                </button>
              </div>
            </div>
          </div>
        )}

        {(hasFormErrors || serverError) && !emailVerificationError && (
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

        {/* Connect Wallet Button */}
        {walletExtensionInstalled === false && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-start gap-2">
            <Wallet className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <span className="font-medium">No wallet detected.</span>{' '}
              <a
                href="https://www.freighter.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-blue-900"
              >
                Install Freighter
              </a>{' '}
              to connect with your Stellar wallet.
            </div>
          </div>
        )}

        {walletExtensionInstalled !== false && (
          <button
            type="button"
            disabled={wallet.connectionState === 'connecting' || walletSigning}
            onClick={
              wallet.connectionState === 'connected' && !walletSigning
                ? onConnectWallet
                : wallet.connectionState === 'connected' && walletSigning
                  ? undefined
                  : connectWallet
            }
            className="w-full mb-4 px-6 py-3 border-2 border-emerald-600 text-emerald-700 rounded-lg font-medium hover:bg-emerald-50 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
            aria-busy={wallet.connectionState === 'connecting' || walletSigning}
          >
            {(wallet.connectionState === 'connecting' || walletSigning) && (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            )}
            {wallet.connectionState === 'connecting'
              ? 'Connecting wallet...'
              : walletSigning
                ? 'Waiting for wallet signature...'
                : wallet.connectionState === 'connected'
                  ? `Sign in with ${wallet.publicKey?.slice(0, 4)}...${wallet.publicKey?.slice(-4)}`
                  : 'Connect Stellar Wallet'}
          </button>
        )}

        {wallet.connectionState === 'connected' && !walletSigning && (
          <div className="mb-4 flex items-center justify-between p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
            <span className="font-medium">Wallet: {wallet.publicKey?.slice(0, 8)}...{wallet.publicKey?.slice(-4)}</span>
            <button
              type="button"
              onClick={disconnectWallet}
              className="text-xs underline hover:text-emerald-900"
            >
              Disconnect
            </button>
          </div>
        )}

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-3 text-gray-500">or continue with email</span>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 text-black" aria-label="Login form">
          <div>
            <label htmlFor="login-email" className="text-sm font-medium text-gray-700">
              Email <span aria-hidden="true" className="text-red-500">*</span>
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
            <div className="flex justify-between items-center">
              <label htmlFor="login-password" className="text-sm font-medium text-gray-700">
                Password <span aria-hidden="true" className="text-red-500">*</span>
              </label>
              <Link
                href="/forgot-password"
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
              <input
                id="login-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (formErrors.password) setFormErrors((p) => ({ ...p, password: undefined }));
                }}
                className={`w-full pl-10 pr-12 py-3 border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                  formErrors.password ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="••••••••"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                aria-required="true"
                aria-invalid={!!formErrors.password}
                aria-describedby={formErrors.password ? 'login-password-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
              </button>
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
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link href="/register" className="text-emerald-600 hover:text-emerald-700 font-medium">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
