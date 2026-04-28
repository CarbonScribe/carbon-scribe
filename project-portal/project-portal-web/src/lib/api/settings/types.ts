// Profile
export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  display_name: string;
  profile_picture_url: string;
  bio: string;
  phone_number: string;
  phone_verified: boolean;
  secondary_email: string;
  address: Record<string, any>;
  organization: string;
  job_title: string;
  website: string;
  language: string;
  timezone: string;
  currency: string;
  date_format: string;
  verification_level: string;
  verification_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfilePayload {
  full_name?: string;
  display_name?: string;
  bio?: string;
  phone_number?: string;
  secondary_email?: string;
  address?: Record<string, any>;
  organization?: string;
  job_title?: string;
  website?: string;
  language?: string;
  timezone?: string;
  currency?: string;
  date_format?: string;
}

// Notifications
export interface NotificationPreference {
  id: string;
  user_id: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  categories: Record<string, boolean>;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_timezone: string;
  emergency_override_enabled: boolean;
  emergency_severity_level: string;
  created_at: string;
  updated_at: string;
}

export interface UpdateNotificationPayload {
  email_enabled?: boolean;
  sms_enabled?: boolean;
  push_enabled?: boolean;
  in_app_enabled?: boolean;
  categories?: Record<string, boolean>;
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  quiet_hours_timezone?: string;
  emergency_override_enabled?: boolean;
  emergency_severity_level?: string;
}

// API Keys
export interface APIKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  key_last_four: string;
  scopes: string[];
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  expires_at: string | null;
  is_active: boolean;
  last_used_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface CreateAPIKeyPayload {
  name: string;
  scopes: string[];
  rate_limit_per_minute?: number;
  rate_limit_per_day?: number;
  expires_at?: string | null;
}

export interface APIKeyWithSecret extends APIKey {
  secret_key: string;
}

export interface APIKeyValidation {
  is_valid: boolean;
  key_id?: string;
  scopes?: string[];
  error?: string;
}

export interface APIKeyUsage {
  key_id: string;
  total_requests: number;
  requests_today: number;
  requests_this_month: number;
  last_used_at: string | null;
  rate_limit_remaining_minute: number;
  rate_limit_remaining_day: number;
}

// Integrations
export interface IntegrationConfiguration {
  id: string;
  user_id: string;
  integration_type: string;
  integration_name: string;
  config_hash: string;
  is_active: boolean;
  is_valid: boolean;
  last_successful_connection: string | null;
  connection_error: string | null;
  webhook_url: string | null;
  webhook_last_delivered: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ConfigureIntegrationPayload {
  integration_type: string;
  config: Record<string, any>;
  webhook_url?: string;
}

export interface IntegrationHealth {
  integration_id: string;
  status: "healthy" | "degraded" | "unhealthy";
  last_checked_at: string;
  last_error?: string;
  response_time_ms: number;
}

export interface OAuthStartResponse {
  oauth_url: string;
  state: string;
  expires_at: string;
}

export interface OAuthCallbackPayload {
  code: string;
  state: string;
}

// Billing
export interface BillingSummary {
  current_plan: string;
  billing_cycle_start: string;
  billing_cycle_end: string;
  amount_used: number;
  amount_limit: number;
  current_usage_percentage: number;
  next_billing_date: string;
  status: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  issued_at: string;
  due_date: string;
  paid_at: string | null;
  status: string;
  pdf_url: string | null;
}

export interface PaymentMethodPayload {
  type: "credit_card" | "debit_card" | "bank_account";
  token: string;
  is_default?: boolean;
}

// API Response wrapper
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

// Error types
export class SettingsError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "SettingsError";
  }
}

export class AuthError extends SettingsError {
  constructor(message: string = "Unauthorized") {
    super(401, message);
    this.name = "AuthError";
  }
}

export class ValidationError extends SettingsError {
  constructor(public errors: Record<string, string[]>, message: string = "Validation failed") {
    super(400, message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends SettingsError {
  constructor(message: string = "Resource not found") {
    super(404, message);
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends SettingsError {
  constructor(public retryAfter: number) {
    super(429, "Too many requests. Please try again later.");
    this.name = "RateLimitError";
  }
}
