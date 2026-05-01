import { describe, it, expect, beforeEach, vi } from "vitest";
import { api } from "@/lib/api/axios";
import {
  createDeleteRequest,
  createExportRequest,
  createRetentionPolicy,
  getPreferences,
  listConsents,
  listPrivacyRequests,
  listRetentionPolicies,
  listRetentionSchedules,
  queryAuditLogs,
  updatePreferences,
  withdrawConsent,
} from "@/lib/api/compliance";

vi.mock("@/lib/api/axios");

describe("Compliance API Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates export request", async () => {
    const payload = {
      data_categories: ["user_profile", "project_data"],
      format: "json",
    };
    const mockResponse = {
      id: "req-1",
      request_type: "export",
      status: "received",
    };

    vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse });

    const result = await createExportRequest(payload);

    expect(result).toEqual(mockResponse);
    expect(api.post).toHaveBeenCalledWith("/compliance/requests/export", payload);
  });

  it("creates delete request", async () => {
    const payload = {
      data_categories: ["project_data"],
      legal_basis: "user_request",
    };
    const mockResponse = {
      id: "req-2",
      request_type: "deletion",
      status: "received",
    };

    vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse });

    const result = await createDeleteRequest(payload);

    expect(result).toEqual(mockResponse);
    expect(api.post).toHaveBeenCalledWith("/compliance/requests/delete", payload);
  });

  it("lists privacy requests with pagination", async () => {
    const params = { status: "received", limit: 20, offset: 0 };
    const mockResponse = {
      data: [{ id: "req-1", status: "received" }],
      total: 1,
      limit: 20,
      offset: 0,
    };

    vi.mocked(api.get).mockResolvedValueOnce({ data: mockResponse });

    const result = await listPrivacyRequests(params);

    expect(result).toEqual(mockResponse);
    expect(api.get).toHaveBeenCalledWith("/compliance/requests", { params });
  });

  it("gets and updates preferences", async () => {
    const pref = {
      id: "pref-1",
      user_id: "user-1",
      marketing_emails: false,
      promotional_emails: false,
      system_notifications: true,
      third_party_sharing: false,
      analytics_tracking: true,
      data_retention_consent: true,
      research_participation: false,
      automated_decision_making: false,
      jurisdiction: "GDPR",
      version: 1,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    vi.mocked(api.get).mockResolvedValueOnce({ data: pref });

    const loaded = await getPreferences();
    expect(loaded).toEqual(pref);
    expect(api.get).toHaveBeenCalledWith("/compliance/preferences");

    const updatePayload = {
      marketing_emails: true,
      analytics_tracking: false,
      jurisdiction: "NDPR",
    };

    const updated = { ...pref, ...updatePayload, version: 2 };
    vi.mocked(api.put).mockResolvedValueOnce({ data: updated });

    const result = await updatePreferences(updatePayload);
    expect(result).toEqual(updated);
    expect(api.put).toHaveBeenCalledWith("/compliance/preferences", updatePayload);
  });

  it("lists and withdraws consents", async () => {
    const records = [
      {
        id: "cons-1",
        user_id: "user-1",
        consent_type: "marketing",
        consent_version: "v1.0",
        consent_given: true,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    vi.mocked(api.get).mockResolvedValueOnce({ data: records });

    const list = await listConsents();
    expect(list).toEqual(records);
    expect(api.get).toHaveBeenCalledWith("/compliance/consents");

    const message = { message: "consent withdrawn successfully" };
    vi.mocked(api.delete).mockResolvedValueOnce({ data: message });

    const result = await withdrawConsent("marketing");
    expect(result).toEqual(message);
    expect(api.delete).toHaveBeenCalledWith("/compliance/consents/marketing");
  });

  it("queries audit logs", async () => {
    const params = { event_type: "privacy", limit: 10, offset: 0 };
    const response = {
      data: [
        {
          log_id: 101,
          event_time: "2026-01-01T00:00:00Z",
          event_type: "privacy",
          event_action: "request_created",
          service_name: "compliance",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      total: 1,
      limit: 10,
      offset: 0,
    };

    vi.mocked(api.get).mockResolvedValueOnce({ data: response });

    const result = await queryAuditLogs(params);
    expect(result).toEqual(response);
    expect(api.get).toHaveBeenCalledWith("/compliance/audit/logs", { params });
  });

  it("creates and lists retention policies", async () => {
    const payload = {
      name: "Default user profile retention",
      data_category: "user_profile",
      retention_period_days: 365,
      jurisdiction: "global",
    };

    const created = {
      id: "pol-1",
      ...payload,
      description: "",
      review_period_days: 365,
      deletion_method: "soft_delete",
      legal_hold_enabled: true,
      is_active: true,
      version: 1,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    vi.mocked(api.post).mockResolvedValueOnce({ data: created });
    const createdResult = await createRetentionPolicy(payload);
    expect(createdResult).toEqual(created);
    expect(api.post).toHaveBeenCalledWith("/compliance/retention/policies", payload);

    const listParams = { data_category: "user_profile", active_only: true };
    vi.mocked(api.get).mockResolvedValueOnce({ data: [created] });

    const list = await listRetentionPolicies(listParams);
    expect(list).toEqual([created]);
    expect(api.get).toHaveBeenCalledWith("/compliance/retention/policies", {
      params: listParams,
    });
  });

  it("lists retention schedules", async () => {
    const schedules = [
      {
        id: "sch-1",
        policy_id: "pol-1",
        data_type: "user_profile",
        next_review_date: "2026-05-01",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];

    vi.mocked(api.get).mockResolvedValueOnce({ data: schedules });

    const result = await listRetentionSchedules({ policy_id: "pol-1" });
    expect(result).toEqual(schedules);
    expect(api.get).toHaveBeenCalledWith("/compliance/retention/schedule", {
      params: { policy_id: "pol-1" },
    });
  });
});
