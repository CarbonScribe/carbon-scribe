export type Role =
  | "farmer"
  | "verifier"
  | "admin"
  | "viewer"
  | string;

export interface User {
  id: string;
  email: string;
  full_name: string;
  organization: string;
  role: Role;
  email_verified: boolean;
  is_active: boolean;
  wallet_address?: string;
  last_login_at?: string;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
  user: User;
}

export interface RegisterResponse {
  user: User;
  verification_token?: string;
  message?: string;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  password: string;
  organization?: string;
}

export type AuthLoadingState = {
  login: boolean;
  register: boolean;
  refresh: boolean;
  profile: boolean;
  logout: boolean;
};

export type WalletState = {
  publicKey: string | null;
  connectionState: import("@/lib/stellar/wallet").WalletConnectionState;
};

export type AuthSlice = {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  expiresIn: number | null;
  tokenType: string;
  isAuthenticated: boolean;

  isHydrated: boolean;
  authLoading: AuthLoadingState;
  authError: string | null;

  wallet: WalletState;

  login: (email: string, password: string) => Promise<void>;
  loginWithWallet: (publicKey: string, signedChallenge: string) => Promise<void>;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  register: (data: RegisterPayload) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  clearError: () => void;
  setHydrated: (v: boolean) => void;
};