export type Role =
  | "farmer"
  | "project_manager"
  | "validator"
  | "admin"
  | string;

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  email_verified: boolean;
  is_active: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  password: string;
}

export type AuthLoadingState = {
  login: boolean;
  register: boolean;
  refresh: boolean;
};

export type AuthSlice = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  isHydrated: boolean;
  authLoading: AuthLoadingState;
  authError: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  clearError: () => void;
  setHydrated: (v: boolean) => void;
};
