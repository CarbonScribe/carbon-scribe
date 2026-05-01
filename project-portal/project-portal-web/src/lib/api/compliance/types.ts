export interface PaginatedResponse<T> {
  data: T;
  total: number;
  limit: number;
  offset: number;
}

export interface PrivacyRequest {
  id: string;
  user_id: string;
  request_type: string;
  request_subtype?: string;
  status: string;
  submitted_at: string;
  completed_at?: string;
  estimated_completion?: string;
  data_categories?: string[];
  date_range_start?: string;
  date_range_end?: string;
  verification_method?: string;
  verified_by?: string;
  verified_at?: string;
  export_file_url?: string;
  export_file_hash?: string;
  deletion_summary?: Record<string, any>;
  error_message?: string;
  legal_basis?: string;
  created_at: string;
  updated_at: string;
}

export interface ExportRequestPayload {
  data_categories?: string[];
  date_range_start?: string;
  date_range_end?: string;
  format?: string;
}

export interface DeleteRequestPayload {
  data_categories?: string[];
  legal_basis: string;
}

export interface PrivacyPreference {
  id: string;
  user_id: string;
  marketing_emails: boolean;
  promotional_emails: boolean;
  system_notifications: boolean;
  third_party_sharing: boolean;
  analytics_tracking: boolean;
  data_retention_consent: boolean;
  research_participation: boolean;
  automated_decision_making: boolean;
  jurisdiction: string;
  version: number;
  previous_version_id?: string;
  created_at: string;
  updated_at: string;
}

export interface UpdatePreferencesPayload {
  marketing_emails?: boolean;
  promotional_emails?: boolean;
  system_notifications?: boolean;
  third_party_sharing?: boolean;
  analytics_tracking?: boolean;
  data_retention_consent?: boolean;
  research_participation?: boolean;
  automated_decision_making?: boolean;
  jurisdiction?: string;
}

export interface ConsentRecord {
  id: string;
  user_id: string;
  consent_type: string;
  consent_version: string;
  consent_given: boolean;
  context?: string;
  purpose?: string;
  ip_address?: string;
  user_agent?: string;
  geolocation?: string;
  expires_at?: string;
  withdrawn_at?: string;
  created_at: string;
}

export interface RecordConsentPayload {
  consent_type: string;
  consent_version: string;
  consent_given: boolean;
  context?: string;
  purpose?: string;
}

export interface AuditLog {
  log_id: number;
  event_time: string;
  event_type: string;
  event_action: string;
  actor_id?: string;
  actor_type?: string;
  actor_ip?: string;
  target_type?: string;
  target_id?: string;
  target_owner_id?: string;
  data_category?: string;
  sensitivity_level?: string;
  service_name: string;
  endpoint?: string;
  http_method?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  permission_used?: string;
  signature?: string;
  hash_chain?: string;
  created_at: string;
}

export interface AuditLogQuery {
  actor_id?: string;
  target_type?: string;
  target_id?: string;
  target_owner_id?: string;
  event_type?: string;
  event_action?: string;
  sensitivity_level?: string;
  service_name?: string;
  start_time?: string;
  end_time?: string;
  limit?: number;
  offset?: number;
}

export interface RetentionPolicy {
  id: string;
  name: string;
  description: string;
  data_category: string;
  jurisdiction: string;
  retention_period_days: number;
  archival_period_days?: number;
  review_period_days: number;
  deletion_method: string;
  anonymization_rules?: Record<string, any>;
  legal_hold_enabled: boolean;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CreateRetentionPolicyPayload {
  name: string;
  description?: string;
  data_category: string;
  jurisdiction?: string;
  retention_period_days: number;
  archival_period_days?: number;
  review_period_days?: number;
  deletion_method?: string;
  anonymization_rules?: Record<string, any>;
  legal_hold_enabled?: boolean;
}

export interface RetentionSchedule {
  id: string;
  policy_id: string;
  policy?: RetentionPolicy;
  data_type: string;
  next_review_date: string;
  next_action_date?: string;
  action_type?: string;
  last_action_date?: string;
  last_action_type?: string;
  last_action_result?: string;
  record_count_estimate?: number;
  created_at: string;
  updated_at: string;
}

export interface ComplianceStats {
  total_requests: number;
  pending_requests: number;
  completed_requests: number;
  active_policies: number;
  active_legal_holds: number;
  consent_rates: Record<string, number>;
  audit_log_count: number;
}