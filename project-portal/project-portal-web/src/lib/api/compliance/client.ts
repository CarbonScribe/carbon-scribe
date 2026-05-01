import { api } from "@/lib/api/axios";
import { handleSettingsError } from "@/lib/errors/settingsErrors";
import type {
  AuditLog,
  AuditLogQuery,
  ComplianceStats,
  ConsentRecord,
  CreateRetentionPolicyPayload,
  DeleteRequestPayload,
  ExportRequestPayload,
  PaginatedResponse,
  PrivacyPreference,
  PrivacyRequest,
  RecordConsentPayload,
  RetentionPolicy,
  RetentionSchedule,
  UpdatePreferencesPayload,
} from "./types";

const COMPLIANCE_BASE = "/compliance";

export async function createExportRequest(
  payload: ExportRequestPayload
): Promise<PrivacyRequest> {
  try {
    const res = await api.post(`${COMPLIANCE_BASE}/requests/export`, payload);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function createDeleteRequest(
  payload: DeleteRequestPayload
): Promise<PrivacyRequest> {
  try {
    const res = await api.post(`${COMPLIANCE_BASE}/requests/delete`, payload);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function getPrivacyRequestStatus(id: string): Promise<PrivacyRequest> {
  try {
    const res = await api.get(`${COMPLIANCE_BASE}/requests/${id}`);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function listPrivacyRequests(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<PrivacyRequest[]>> {
  try {
    const res = await api.get(`${COMPLIANCE_BASE}/requests`, { params });
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function getPreferences(): Promise<PrivacyPreference> {
  try {
    const res = await api.get(`${COMPLIANCE_BASE}/preferences`);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function updatePreferences(
  payload: UpdatePreferencesPayload
): Promise<PrivacyPreference> {
  try {
    const res = await api.put(`${COMPLIANCE_BASE}/preferences`, payload);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function recordConsent(
  payload: RecordConsentPayload
): Promise<ConsentRecord> {
  try {
    const res = await api.post(`${COMPLIANCE_BASE}/consents`, payload);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function listConsents(): Promise<ConsentRecord[]> {
  try {
    const res = await api.get(`${COMPLIANCE_BASE}/consents`);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function withdrawConsent(type: string): Promise<{ message: string }> {
  try {
    const res = await api.delete(`${COMPLIANCE_BASE}/consents/${type}`);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function queryAuditLogs(
  params?: AuditLogQuery
): Promise<PaginatedResponse<AuditLog[]>> {
  try {
    const res = await api.get(`${COMPLIANCE_BASE}/audit/logs`, { params });
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function createRetentionPolicy(
  payload: CreateRetentionPolicyPayload
): Promise<RetentionPolicy> {
  try {
    const res = await api.post(`${COMPLIANCE_BASE}/retention/policies`, payload);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function listRetentionPolicies(params?: {
  data_category?: string;
  jurisdiction?: string;
  active_only?: boolean;
}): Promise<RetentionPolicy[]> {
  try {
    const res = await api.get(`${COMPLIANCE_BASE}/retention/policies`, { params });
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function getRetentionPolicy(id: string): Promise<RetentionPolicy> {
  try {
    const res = await api.get(`${COMPLIANCE_BASE}/retention/policies/${id}`);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function updateRetentionPolicy(
  id: string,
  payload: CreateRetentionPolicyPayload
): Promise<RetentionPolicy> {
  try {
    const res = await api.put(`${COMPLIANCE_BASE}/retention/policies/${id}`, payload);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function listRetentionSchedules(params?: {
  policy_id?: string;
}): Promise<RetentionSchedule[]> {
  try {
    const res = await api.get(`${COMPLIANCE_BASE}/retention/schedule`, { params });
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function getComplianceStats(): Promise<ComplianceStats> {
  try {
    const res = await api.get(`${COMPLIANCE_BASE}/stats`);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export const complianceClient = {
  requests: {
    createExport: createExportRequest,
    createDelete: createDeleteRequest,
    getStatus: getPrivacyRequestStatus,
    list: listPrivacyRequests,
  },
  preferences: {
    get: getPreferences,
    update: updatePreferences,
  },
  consents: {
    record: recordConsent,
    list: listConsents,
    withdraw: withdrawConsent,
  },
  audit: {
    queryLogs: queryAuditLogs,
  },
  retention: {
    createPolicy: createRetentionPolicy,
    listPolicies: listRetentionPolicies,
    getPolicy: getRetentionPolicy,
    updatePolicy: updateRetentionPolicy,
    listSchedules: listRetentionSchedules,
  },
  stats: {
    get: getComplianceStats,
  },
};