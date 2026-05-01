"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createDeleteRequest,
  createExportRequest,
  createRetentionPolicy,
  getComplianceStats,
  getPreferences,
  listConsents,
  listPrivacyRequests,
  listRetentionPolicies,
  listRetentionSchedules,
  queryAuditLogs,
  recordConsent,
  updatePreferences,
  updateRetentionPolicy,
  withdrawConsent,
} from "@/lib/api/compliance";
import type {
  AuditLog,
  ComplianceStats,
  ConsentRecord,
  CreateRetentionPolicyPayload,
  PaginatedResponse,
  PrivacyPreference,
  PrivacyRequest,
  RetentionPolicy,
  RetentionSchedule,
  UpdatePreferencesPayload,
} from "@/lib/api/compliance";
import { useSettings } from "@/lib/hooks/useSettings";
import { showToast } from "@/components/ui/Toast";

const CONSENT_TYPES = ["marketing", "analytics", "third_party", "research"];

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toPolicyPayload(policy: RetentionPolicy): CreateRetentionPolicyPayload {
  return {
    name: policy.name,
    description: policy.description,
    data_category: policy.data_category,
    jurisdiction: policy.jurisdiction,
    retention_period_days: policy.retention_period_days,
    archival_period_days: policy.archival_period_days,
    review_period_days: policy.review_period_days,
    deletion_method: policy.deletion_method,
    anonymization_rules: policy.anonymization_rules,
    legal_hold_enabled: policy.legal_hold_enabled,
  };
}

export function ComplianceTab() {
  const preferencesState = useSettings<PrivacyPreference>();
  const consentsState = useSettings<ConsentRecord[]>();
  const requestsState = useSettings<PaginatedResponse<PrivacyRequest[]>>();
  const auditState = useSettings<PaginatedResponse<AuditLog[]>>();
  const retentionState = useSettings<RetentionPolicy[]>();
  const schedulesState = useSettings<RetentionSchedule[]>();
  const statsState = useSettings<ComplianceStats>();

  const updatePreferencesState = useSettings<PrivacyPreference>();
  const requestActionState = useSettings<PrivacyRequest>();
  const consentActionState = useSettings<any>();
  const retentionActionState = useSettings<RetentionPolicy>();

  const [preferencesForm, setPreferencesForm] = useState<UpdatePreferencesPayload>({});
  const [exportCategories, setExportCategories] = useState("");
  const [deleteCategories, setDeleteCategories] = useState("");
  const [deleteLegalBasis, setDeleteLegalBasis] = useState("user_request");
  const [auditEventType, setAuditEventType] = useState("");
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);

  const [policyForm, setPolicyForm] = useState<CreateRetentionPolicyPayload>({
    name: "",
    description: "",
    data_category: "user_profile",
    jurisdiction: "global",
    retention_period_days: 365,
    review_period_days: 365,
    deletion_method: "soft_delete",
    legal_hold_enabled: true,
  });

  const selectedPolicy = useMemo(
    () => retentionState.data?.find((policy) => policy.id === selectedPolicyId),
    [retentionState.data, selectedPolicyId]
  );

  const loadAll = async () => {
    try {
      await Promise.all([
        preferencesState.execute(() => getPreferences()),
        consentsState.execute(() => listConsents()),
        requestsState.execute(() => listPrivacyRequests({ limit: 20, offset: 0 })),
        auditState.execute(() => queryAuditLogs({ limit: 20, offset: 0 })),
        retentionState.execute(() => listRetentionPolicies({ active_only: true })),
        schedulesState.execute(() => listRetentionSchedules()),
        statsState.execute(() => getComplianceStats()),
      ]);
    } catch {
      showToast("error", "Failed to load compliance data");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (preferencesState.data) {
      const pref = preferencesState.data;
      setPreferencesForm({
        marketing_emails: pref.marketing_emails,
        promotional_emails: pref.promotional_emails,
        system_notifications: pref.system_notifications,
        third_party_sharing: pref.third_party_sharing,
        analytics_tracking: pref.analytics_tracking,
        data_retention_consent: pref.data_retention_consent,
        research_participation: pref.research_participation,
        automated_decision_making: pref.automated_decision_making,
        jurisdiction: pref.jurisdiction,
      });
    }
  }, [preferencesState.data]);

  const isInitialLoading =
    (preferencesState.isLoading || requestsState.isLoading || retentionState.isLoading) &&
    !preferencesState.data;

  const togglePreference = (key: keyof UpdatePreferencesPayload) => {
    setPreferencesForm((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? false),
    }));
  };

  const handleSavePreferences = async () => {
    try {
      await updatePreferencesState.execute(() => updatePreferences(preferencesForm));
      showToast("success", "Privacy preferences updated");
      await preferencesState.execute(() => getPreferences());
    } catch {
      showToast("error", "Failed to update privacy preferences");
    }
  };

  const handleCreateExport = async () => {
    try {
      await requestActionState.execute(() =>
        createExportRequest({
          data_categories: parseCsv(exportCategories),
          format: "json",
        })
      );
      showToast("success", "Export request submitted");
      setExportCategories("");
      await requestsState.execute(() => listPrivacyRequests({ limit: 20, offset: 0 }));
    } catch {
      showToast("error", "Failed to submit export request");
    }
  };

  const handleCreateDelete = async () => {
    try {
      await requestActionState.execute(() =>
        createDeleteRequest({
          data_categories: parseCsv(deleteCategories),
          legal_basis: deleteLegalBasis,
        })
      );
      showToast("success", "Delete request submitted");
      setDeleteCategories("");
      await requestsState.execute(() => listPrivacyRequests({ limit: 20, offset: 0 }));
    } catch {
      showToast("error", "Failed to submit delete request");
    }
  };

  const hasActiveConsent = (type: string): boolean => {
    const records = consentsState.data ?? [];
    const latest = records.find((record) => record.consent_type === type);
    return Boolean(latest?.consent_given && !latest?.withdrawn_at);
  };

  const handleConsentToggle = async (type: string) => {
    try {
      if (hasActiveConsent(type)) {
        await consentActionState.execute(() => withdrawConsent(type));
        showToast("success", `${type} consent withdrawn`);
      } else {
        await consentActionState.execute(() =>
          recordConsent({
            consent_type: type,
            consent_version: "v1.0",
            consent_given: true,
            context: "settings_portal",
            purpose: `user_${type}_preference`,
          })
        );
        showToast("success", `${type} consent recorded`);
      }
      await consentsState.execute(() => listConsents());
      await statsState.execute(() => getComplianceStats());
    } catch {
      showToast("error", "Failed to update consent");
    }
  };

  const refreshAuditLogs = async () => {
    try {
      await auditState.execute(() =>
        queryAuditLogs({
          event_type: auditEventType || undefined,
          limit: 20,
          offset: 0,
        })
      );
    } catch {
      showToast("error", "Failed to load audit logs");
    }
  };

  const handleSavePolicy = async () => {
    if (!policyForm.name || !policyForm.data_category || !policyForm.retention_period_days) {
      showToast("error", "Name, data category and retention days are required");
      return;
    }

    try {
      if (selectedPolicy) {
        await retentionActionState.execute(() =>
          updateRetentionPolicy(selectedPolicy.id, policyForm)
        );
        showToast("success", "Retention policy updated");
      } else {
        await retentionActionState.execute(() => createRetentionPolicy(policyForm));
        showToast("success", "Retention policy created");
      }

      setSelectedPolicyId(null);
      setPolicyForm({
        name: "",
        description: "",
        data_category: "user_profile",
        jurisdiction: "global",
        retention_period_days: 365,
        review_period_days: 365,
        deletion_method: "soft_delete",
        legal_hold_enabled: true,
      });

      await Promise.all([
        retentionState.execute(() => listRetentionPolicies({ active_only: true })),
        schedulesState.execute(() => listRetentionSchedules()),
        statsState.execute(() => getComplianceStats()),
      ]);
    } catch {
      showToast("error", "Failed to save retention policy");
    }
  };

  const startEditPolicy = (policy: RetentionPolicy) => {
    setSelectedPolicyId(policy.id);
    setPolicyForm(toPolicyPayload(policy));
  };

  if (isInitialLoading) {
    return (
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (preferencesState.error) {
    return <div className="bg-red-50 p-4 rounded text-red-700">{preferencesState.error.message}</div>;
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold mb-4">Compliance Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Total Requests</p>
            <p className="text-2xl font-semibold">{statsState.data?.total_requests ?? 0}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Pending Requests</p>
            <p className="text-2xl font-semibold">{statsState.data?.pending_requests ?? 0}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Active Policies</p>
            <p className="text-2xl font-semibold">{statsState.data?.active_policies ?? 0}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Audit Logs</p>
            <p className="text-2xl font-semibold">{statsState.data?.audit_log_count ?? 0}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Privacy Requests</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <h3 className="font-medium">Request Data Export</h3>
            <input
              type="text"
              value={exportCategories}
              onChange={(e) => setExportCategories(e.target.value)}
              placeholder="data categories (comma-separated)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <button
              onClick={handleCreateExport}
              disabled={requestActionState.isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {requestActionState.isLoading ? "Submitting..." : "Submit Export Request"}
            </button>
          </div>
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <h3 className="font-medium">Request Data Deletion</h3>
            <input
              type="text"
              value={deleteCategories}
              onChange={(e) => setDeleteCategories(e.target.value)}
              placeholder="data categories (comma-separated)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <input
              type="text"
              value={deleteLegalBasis}
              onChange={(e) => setDeleteLegalBasis(e.target.value)}
              placeholder="legal basis"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <button
              onClick={handleCreateDelete}
              disabled={requestActionState.isLoading}
              className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50"
            >
              {requestActionState.isLoading ? "Submitting..." : "Submit Delete Request"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Submitted</th>
                <th className="px-4 py-2 text-left">Estimated Completion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(requestsState.data?.data ?? []).map((request) => (
                <tr key={request.id}>
                  <td className="px-4 py-2 capitalize">{request.request_type}</td>
                  <td className="px-4 py-2 capitalize">{request.status}</td>
                  <td className="px-4 py-2">{new Date(request.submitted_at).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    {request.estimated_completion
                      ? new Date(request.estimated_completion).toLocaleString()
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Preferences & Consents</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-lg p-4 space-y-4">
            <h3 className="font-medium">Privacy Preferences</h3>

            {[
              ["Marketing Emails", "marketing_emails"],
              ["Promotional Emails", "promotional_emails"],
              ["System Notifications", "system_notifications"],
              ["Third Party Sharing", "third_party_sharing"],
              ["Analytics Tracking", "analytics_tracking"],
              ["Data Retention Consent", "data_retention_consent"],
              ["Research Participation", "research_participation"],
              ["Automated Decision Making", "automated_decision_making"],
            ].map(([label, key]) => (
              <label key={key} className="flex items-center justify-between">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(preferencesForm[key as keyof UpdatePreferencesPayload])}
                  onChange={() => togglePreference(key as keyof UpdatePreferencesPayload)}
                  className="w-4 h-4"
                />
              </label>
            ))}

            <div>
              <label className="block text-sm text-gray-600 mb-1">Jurisdiction</label>
              <input
                type="text"
                value={preferencesForm.jurisdiction || ""}
                onChange={(e) =>
                  setPreferencesForm((prev) => ({ ...prev, jurisdiction: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <button
              onClick={handleSavePreferences}
              disabled={updatePreferencesState.isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {updatePreferencesState.isLoading ? "Saving..." : "Save Preferences"}
            </button>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 space-y-4">
            <h3 className="font-medium">Consents</h3>
            {CONSENT_TYPES.map((type) => (
              <div key={type} className="flex items-center justify-between border rounded p-3">
                <div>
                  <p className="font-medium capitalize">{type.replace("_", " ")}</p>
                  <p className="text-xs text-gray-500">
                    {hasActiveConsent(type) ? "Active" : "Not granted"}
                  </p>
                </div>
                <button
                  onClick={() => handleConsentToggle(type)}
                  disabled={consentActionState.isLoading}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  {hasActiveConsent(type) ? "Withdraw" : "Grant"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Audit Logs</h2>
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={auditEventType}
            onChange={(e) => setAuditEventType(e.target.value)}
            placeholder="filter by event type"
            className="px-3 py-2 border border-gray-300 rounded-lg flex-1"
          />
          <button
            onClick={refreshAuditLogs}
            disabled={auditState.isLoading}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {auditState.isLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Time</th>
                <th className="px-4 py-2 text-left">Event</th>
                <th className="px-4 py-2 text-left">Action</th>
                <th className="px-4 py-2 text-left">Service</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(auditState.data?.data ?? []).map((log) => (
                <tr key={log.log_id}>
                  <td className="px-4 py-2">{new Date(log.event_time).toLocaleString()}</td>
                  <td className="px-4 py-2">{log.event_type}</td>
                  <td className="px-4 py-2">{log.event_action}</td>
                  <td className="px-4 py-2">{log.service_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Retention Policies</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <h3 className="font-medium">{selectedPolicy ? "Edit Policy" : "Create Policy"}</h3>
            <input
              type="text"
              value={policyForm.name || ""}
              onChange={(e) => setPolicyForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Policy name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <input
              type="text"
              value={policyForm.data_category || ""}
              onChange={(e) =>
                setPolicyForm((prev) => ({ ...prev, data_category: e.target.value }))
              }
              placeholder="Data category"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <input
              type="number"
              value={policyForm.retention_period_days || 0}
              onChange={(e) =>
                setPolicyForm((prev) => ({
                  ...prev,
                  retention_period_days: Number(e.target.value),
                }))
              }
              placeholder="Retention days"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <textarea
              value={policyForm.description || ""}
              onChange={(e) =>
                setPolicyForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Description"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <label className="flex items-center justify-between">
              <span>Legal hold enabled</span>
              <input
                type="checkbox"
                checked={Boolean(policyForm.legal_hold_enabled)}
                onChange={(e) =>
                  setPolicyForm((prev) => ({
                    ...prev,
                    legal_hold_enabled: e.target.checked,
                  }))
                }
                className="w-4 h-4"
              />
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleSavePolicy}
                disabled={retentionActionState.isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {retentionActionState.isLoading
                  ? "Saving..."
                  : selectedPolicy
                    ? "Update Policy"
                    : "Create Policy"}
              </button>
              {selectedPolicy ? (
                <button
                  onClick={() => {
                    setSelectedPolicyId(null);
                    setPolicyForm({
                      name: "",
                      description: "",
                      data_category: "user_profile",
                      jurisdiction: "global",
                      retention_period_days: 365,
                      review_period_days: 365,
                      deletion_method: "soft_delete",
                      legal_hold_enabled: true,
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium mb-3">Policies</h3>
              <div className="space-y-2 max-h-64 overflow-auto">
                {(retentionState.data ?? []).map((policy) => (
                  <div key={policy.id} className="border rounded p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{policy.name}</p>
                        <p className="text-xs text-gray-500">
                          {policy.data_category} • {policy.retention_period_days} days
                        </p>
                      </div>
                      <button
                        onClick={() => startEditPolicy(policy)}
                        className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium mb-3">Retention Schedules</h3>
              <div className="space-y-2 max-h-64 overflow-auto">
                {(schedulesState.data ?? []).map((schedule) => (
                  <div key={schedule.id} className="border rounded p-3 text-sm">
                    <p className="font-medium">{schedule.data_type}</p>
                    <p className="text-gray-500">
                      Next review: {new Date(schedule.next_review_date).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}