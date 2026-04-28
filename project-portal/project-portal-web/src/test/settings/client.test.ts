import { describe, it, expect, beforeEach, vi } from "vitest";
import { api } from "@/lib/api/axios";
import {
  getProfile,
  updateProfile,
  getNotifications,
  updateNotifications,
  getAPIKeys,
  createAPIKey,
  deleteAPIKey,
  getIntegrations,
  getBillingSummary,
  getInvoices,
} from "@/lib/api/settings/client";
import { SettingsError, ValidationError, AuthError } from "@/lib/api/settings/types";

vi.mock("@/lib/api/axios");

describe("Settings API Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Profile", () => {
    it("should fetch profile successfully", async () => {
      const mockProfile = {
        id: "1",
        user_id: "user-1",
        full_name: "John Doe",
        display_name: "johndoe",
        profile_picture_url: "https://example.com/pic.jpg",
        bio: "Test bio",
        phone_number: "+1234567890",
        phone_verified: true,
        secondary_email: "john@example.com",
        address: { city: "New York" },
        organization: "Test Org",
        job_title: "Engineer",
        website: "https://example.com",
        language: "en",
        timezone: "UTC",
        currency: "USD",
        date_format: "YYYY-MM-DD",
        verification_level: "basic",
        verification_data: {},
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      vi.mocked(api.get).mockResolvedValueOnce({ data: mockProfile });

      const profile = await getProfile();
      expect(profile).toEqual(mockProfile);
      expect(api.get).toHaveBeenCalledWith("/settings/profile", {
        params: { segmented: undefined },
      });
    });

    it("should update profile successfully", async () => {
      const updateData = {
        full_name: "Jane Doe",
        bio: "Updated bio",
      };

      const mockResponse = {
        id: "1",
        full_name: "Jane Doe",
      };

      vi.mocked(api.put).mockResolvedValueOnce({ data: mockResponse });

      const result = await updateProfile(updateData);
      expect(result).toEqual(mockResponse);
      expect(api.put).toHaveBeenCalledWith("/settings/profile", updateData);
    });

    it("should handle profile fetch error", async () => {
      const error = new Error("Network error");
      vi.mocked(api.get).mockRejectedValueOnce(error);

      await expect(getProfile()).rejects.toThrow();
    });
  });

  describe("Notifications", () => {
    it("should fetch notification preferences successfully", async () => {
      const mockNotifications = {
        id: "1",
        user_id: "user-1",
        email_enabled: true,
        sms_enabled: false,
        push_enabled: true,
        in_app_enabled: true,
        categories: { marketing: true, alerts: true },
        quiet_hours_enabled: false,
        quiet_hours_start: "22:00:00",
        quiet_hours_end: "08:00:00",
        quiet_hours_timezone: "UTC",
        emergency_override_enabled: true,
        emergency_severity_level: "high",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      vi.mocked(api.get).mockResolvedValueOnce({ data: mockNotifications });

      const notifications = await getNotifications();
      expect(notifications).toEqual(mockNotifications);
      expect(api.get).toHaveBeenCalledWith("/settings/notifications");
    });

    it("should update notification preferences", async () => {
      const updateData = {
        email_enabled: false,
        sms_enabled: true,
      };

      const mockResponse = {
        id: "1",
        ...updateData,
      };

      vi.mocked(api.put).mockResolvedValueOnce({ data: mockResponse });

      const result = await updateNotifications(updateData);
      expect(result).toEqual(mockResponse);
      expect(api.put).toHaveBeenCalledWith("/settings/notifications", updateData);
    });
  });

  describe("API Keys", () => {
    it("should fetch API keys list", async () => {
      const mockKeys = [
        {
          id: "key-1",
          user_id: "user-1",
          name: "Production Key",
          key_prefix: "sk_prod_",
          key_last_four: "1234",
          scopes: ["read", "write"],
          rate_limit_per_minute: 1000,
          rate_limit_per_day: 100000,
          expires_at: null,
          is_active: true,
          last_used_at: "2024-01-20T00:00:00Z",
          metadata: {},
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      vi.mocked(api.get).mockResolvedValueOnce({ data: mockKeys });

      const keys = await getAPIKeys();
      expect(keys).toEqual(mockKeys);
      expect(api.get).toHaveBeenCalledWith("/settings/api-keys");
    });

    it("should create new API key", async () => {
      const payload = {
        name: "New Key",
        scopes: ["read", "write"],
      };

      const mockResponse = {
        id: "key-2",
        ...payload,
        secret_key: "sk_test_1234567890",
        created_at: "2024-01-21T00:00:00Z",
      };

      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse });

      const result = await createAPIKey(payload);
      expect(result).toEqual(mockResponse);
      expect(api.post).toHaveBeenCalledWith("/settings/api-keys", payload);
    });

    it("should delete API key", async () => {
      const keyId = "key-1";
      vi.mocked(api.delete).mockResolvedValueOnce({
        data: { message: "API key deleted successfully" },
      });

      const result = await deleteAPIKey(keyId);
      expect(result.message).toBeDefined();
      expect(api.delete).toHaveBeenCalledWith(`/settings/api-keys/${keyId}`);
    });
  });

  describe("Integrations", () => {
    it("should fetch integrations list", async () => {
      const mockIntegrations = [
        {
          id: "int-1",
          user_id: "user-1",
          integration_type: "slack",
          integration_name: "Slack Workspace",
          config_hash: "hash123",
          is_active: true,
          is_valid: true,
          last_successful_connection: "2024-01-20T00:00:00Z",
          connection_error: null,
          webhook_url: "https://example.com/webhook",
          webhook_last_delivered: "2024-01-20T00:00:00Z",
          metadata: { workspace_id: "W123" },
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-20T00:00:00Z",
        },
      ];

      vi.mocked(api.get).mockResolvedValueOnce({ data: mockIntegrations });

      const integrations = await getIntegrations();
      expect(integrations).toEqual(mockIntegrations);
      expect(api.get).toHaveBeenCalledWith("/settings/integrations");
    });
  });

  describe("Billing", () => {
    it("should fetch billing summary", async () => {
      const mockBilling = {
        current_plan: "pro",
        billing_cycle_start: "2024-01-01T00:00:00Z",
        billing_cycle_end: "2024-02-01T00:00:00Z",
        amount_used: 50,
        amount_limit: 100,
        current_usage_percentage: 50,
        next_billing_date: "2024-02-01T00:00:00Z",
        status: "active",
      };

      vi.mocked(api.get).mockResolvedValueOnce({ data: mockBilling });

      const billing = await getBillingSummary();
      expect(billing).toEqual(mockBilling);
      expect(api.get).toHaveBeenCalledWith("/settings/billing");
    });

    it("should fetch invoices list", async () => {
      const mockInvoices = [
        {
          id: "inv-1",
          user_id: "user-1",
          amount: 100,
          currency: "USD",
          issued_at: "2024-01-01T00:00:00Z",
          due_date: "2024-01-15T00:00:00Z",
          paid_at: "2024-01-10T00:00:00Z",
          status: "paid",
          pdf_url: "https://example.com/inv-1.pdf",
        },
      ];

      vi.mocked(api.get).mockResolvedValueOnce({ data: mockInvoices });

      const invoices = await getInvoices();
      expect(invoices).toEqual(mockInvoices);
      expect(api.get).toHaveBeenCalledWith("/settings/billing/invoices");
    });
  });
});
