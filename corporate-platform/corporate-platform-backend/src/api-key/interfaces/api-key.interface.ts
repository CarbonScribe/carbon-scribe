export interface ApiKeyPublic {
  id: string;
  name: string;
  prefix: string;
  companyId: string;
  createdBy: string;
  permissions: string[];
  lastUsedAt: Date | null;
  requestCount: number;
  expiresAt: Date | null;
  rateLimit: number;
  ipWhitelist: string[];
  isActive: boolean;
  revokedAt: Date | null;
  revokedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  isExpired: boolean;
}

export interface ApiKeyAuthContext {
  id: string;
  name: string;
  prefix: string;
  companyId: string;
  createdBy: string;
  permissions: string[];
  rateLimit: number;
  ipWhitelist: string[];
}

export interface ApiKeyRateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

export interface ApiKeyValidationResult {
  apiKey: ApiKeyAuthContext;
  rateLimit: ApiKeyRateLimitInfo;
}
