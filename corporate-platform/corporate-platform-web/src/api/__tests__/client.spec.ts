/**
 * Tests for API client
 */

import { apiClient, ApiErrorClass, ApiResponse } from "@/api/client";

describe("ApiClient", () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  describe("GET requests", () => {
    it("should make a successful GET request", async () => {
      const mockResponse: ApiResponse = {
        success: true,
        data: { id: 1, name: "Test" },
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => mockResponse,
      });

      const result = await apiClient.get("/test");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/test"),
        expect.objectContaining({ method: "GET", credentials: "include" }),
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 1, name: "Test" });
    });

    it("should include credentials in requests", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: {} }),
      });

      await apiClient.get("/test");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ credentials: "include" }),
      );
    });

    it("should handle error responses", async () => {
      const errorResponse = {
        success: false,
        error: "Not found",
        code: "NOT_FOUND",
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => errorResponse,
      });

      await expect(apiClient.get("/test")).rejects.toThrow(ApiErrorClass);
    });
  });

  describe("POST requests", () => {
    it("should make a POST request with body", async () => {
      const mockData = { id: 1, name: "Test" };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: mockData }),
      });

      const result = await apiClient.post("/test", { name: "Test" });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/test"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "Test" }),
        }),
      );
      expect(result.data).toEqual(mockData);
    });
  });

  describe("Request interceptors", () => {
    it("should apply request interceptors", async () => {
      apiClient.addRequestInterceptor((config) => {
        return {
          ...config,
          headers: {
            ...(config.headers as any),
            "X-Custom-Header": "test-value",
          },
        };
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: {} }),
      });

      await apiClient.get("/test");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ "X-Custom-Header": "test-value" }),
        }),
      );
    });
  });

  describe("Error handling", () => {
    it("should handle network errors", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Network error"),
      );

      await expect(apiClient.get("/test")).rejects.toThrow(ApiErrorClass);
    });

    it("should preserve error details", async () => {
      const errorResponse = {
        success: false,
        error: "Validation failed",
        errors: { name: ["Name is required"] },
        code: "VALIDATION_ERROR",
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => errorResponse,
      });

      try {
        await apiClient.get("/test");
        fail("Should have thrown");
      } catch (error) {
        if (error instanceof ApiErrorClass) {
          expect(error.status).toBe(400);
          expect(error.errors).toEqual({ name: ["Name is required"] });
          expect(error.code).toBe("VALIDATION_ERROR");
        }
      }
    });
  });
});
