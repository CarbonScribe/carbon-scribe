import { api } from "./axios";
import type {
  LoginCredentials,
  RegisterPayload,
  AuthResponse,
  User,
} from "@/lib/store/auth/auth.types";

// These shapes must match backend responses.
function normalizeAuthResponse(data: any): AuthResponse {
  // Variant A: { token, user }
  if (data?.token && data?.user) return data;

  // Variant B: { access_token, user }
  if (data?.access_token && data?.user)
    return { token: data.access_token, user: data.user };

  // Variant C: { token, ...userFields }
  if (data?.token && data?.email) {
    const user: User = {
      id: data.id,
      email: data.email,
      full_name: data.full_name ?? data.fullName ?? "",
      role: data.role ?? "farmer",
      email_verified: Boolean(data.email_verified),
      is_active: Boolean(data.is_active),
    };
    return { token: data.token, user };
  }

  throw new Error("Unexpected auth response shape from server");
}

export async function loginApi(
  payload: LoginCredentials,
): Promise<AuthResponse> {
  const res = await api.post("/auth/login", payload);
  return normalizeAuthResponse(res.data);
}

export async function registerApi(
  payload: RegisterPayload,
): Promise<AuthResponse | { user: User }> {
  const res = await api.post("/auth/register", payload);
  try {
    return normalizeAuthResponse(res.data);
  } catch {
    return res.data;
  }
}

export async function pingApi(): Promise<any> {
  const res = await api.get("/auth/ping");
  return res.data;
}
