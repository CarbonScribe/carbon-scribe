import { api } from "./axios";
import type {
  LoginCredentials,
  RegisterPayload,
  AuthResponse,
  User,
  RegisterResponse,
  RefreshResponse,
} from "@/lib/store/auth/auth.types";

export function normalizeUser(data: any): User {
  return {
    id: data?.id ?? "",
    email: data?.email ?? "",
    full_name: data?.full_name ?? "",
    organization: data?.organization ?? "",
    role: data?.role ?? "farmer",
    email_verified: Boolean(data?.email_verified),
    is_active: Boolean(data?.is_active ?? true),
    wallet_address: data?.wallet_address,
    last_login_at: data?.last_login_at,
    created_at: data?.created_at,
  };
}

export async function loginApi(
  payload: LoginCredentials,
): Promise<AuthResponse> {
  const res = await api.post("/auth/login", payload);
  return {
    access_token: res.data.access_token,
    refresh_token: res.data.refresh_token,
    expires_in: Number(res.data.expires_in ?? 0),
    token_type: res.data.token_type ?? "Bearer",
    user: normalizeUser(res.data.user),
  };
}

export async function registerApi(
  payload: RegisterPayload,
): Promise<RegisterResponse> {
  const res = await api.post("/auth/register", payload);
  return {
    user: normalizeUser(res.data.user),
    verification_token: res.data.verification_token,
    message: res.data.message,
  };
}

export async function refreshApi(refreshToken: string): Promise<RefreshResponse> {
  const res = await api.post("/auth/refresh", { refresh_token: refreshToken });
  return {
    access_token: res.data.access_token,
    refresh_token: res.data.refresh_token,
    expires_in: Number(res.data.expires_in ?? 0),
    token_type: res.data.token_type ?? "Bearer",
  };
}

export async function getProfileApi(): Promise<User> {
  const res = await api.get("/auth/me");
  return normalizeUser(res.data);
}

export async function logoutApi(): Promise<void> {
  await api.post("/auth/logout");
}

export async function verifyEmailApi(token: string): Promise<{ message: string }> {
  const res = await api.post("/auth/verify-email", { token });
  return { message: res.data?.message ?? "Email verified successfully" };
}

export async function requestPasswordResetApi(email: string): Promise<{ message: string; token?: string }> {
  const res = await api.post("/auth/request-password-reset", { email });
  return {
    message: res.data?.message ?? "If the email exists, a password reset link has been sent",
    token: res.data?.token,
  };
}

export async function resetPasswordApi(payload: { token: string; new_password: string }): Promise<{ message: string }> {
  const res = await api.post("/auth/reset-password", payload);
  return { message: res.data?.message ?? "Password reset successfully" };
}

export async function changePasswordApi(payload: { current_password: string; new_password: string }): Promise<{ message: string }> {
  const res = await api.post("/auth/change-password", payload);
  return { message: res.data?.message ?? "Password changed successfully" };
}

export async function updateProfileApi(payload: { full_name?: string; organization?: string }): Promise<User> {
  const res = await api.put("/auth/me", payload);
  return normalizeUser(res.data);
}

export async function walletChallengeApi(publicKey: string): Promise<{ challenge: string; expires_in: number }> {
  const res = await api.post("/auth/wallet-challenge", { public_key: publicKey });
  return {
    challenge: res.data?.challenge ?? "",
    expires_in: Number(res.data?.expires_in ?? 900),
  };
}

export async function walletLoginApi(payload: { public_key: string; signed_challenge: string }): Promise<AuthResponse> {
  const res = await api.post("/auth/wallet-login", payload);
  return {
    access_token: res.data.access_token,
    refresh_token: res.data.refresh_token,
    expires_in: Number(res.data.expires_in ?? 0),
    token_type: res.data.token_type ?? "Bearer",
    user: normalizeUser(res.data.user),
  };
}

export async function pingApi(): Promise<any> {
  const res = await api.get("/ping");
  return res.data;
}
