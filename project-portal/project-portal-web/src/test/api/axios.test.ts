import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { api } from "@/lib/api/axios";
import { showErrorToast } from "@/lib/utils/toast";

// Spy on axios.create before dynamically importing geospatial api to verify its configuration
const createSpy = vi.spyOn(axios, "create");

// Mock the toast library to assert toast notifications are shown correctly
vi.mock("@/lib/utils/toast", () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
  showInfoToast: vi.fn(),
  showWarningToast: vi.fn(),
}));

describe("Axios Timeout Configurations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Main Axios Instance", () => {
    it("should configure the main Axios instance with a 10-second timeout", () => {
      expect(api.defaults.timeout).toBe(10_000);
    });

    it("should intercept timeout errors and display a user-friendly error toast", async () => {
      // Retrieve the response error interceptor handler
      const responseInterceptor = (api.interceptors.response as any).handlers[0];
      
      const mockTimeoutError = {
        code: "ECONNABORTED",
        message: "timeout of 10000ms exceeded",
        config: { url: "/projects" },
      };

      // Call the rejection handler and expect it to reject with the error
      await expect(responseInterceptor.rejected(mockTimeoutError)).rejects.toEqual(mockTimeoutError);

      // Verify showErrorToast was called with the friendly message and description
      expect(showErrorToast).toHaveBeenCalledWith(
        "Request timed out",
        expect.objectContaining({
          description: "The server took too long to respond. Please check your connection and try again.",
          retryable: true,
        })
      );
    });

    it("should pass normal errors through without rewriting them", async () => {
      const responseInterceptor = (api.interceptors.response as any).handlers[0];

      const mockServerError = {
        response: {
          status: 500,
          data: { message: "Internal Server Error" },
        },
        config: { url: "/projects" },
      };

      await expect(responseInterceptor.rejected(mockServerError)).rejects.toEqual(mockServerError);

      expect(showErrorToast).toHaveBeenCalledWith(
        "Internal Server Error",
        expect.objectContaining({
          description: "A server error occurred. Please try again in a moment.",
          retryable: true,
        })
      );
    });
  });

  describe("Geospatial Axios Instance", () => {
    it("should configure geospatial Axios instance with a 10-second timeout", async () => {
      // Dynamically import the geospatial API module to trigger axios.create call
      await import("@/lib/geospatial/api");

      // Verify that one of the axios.create calls configured a 10s timeout
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 10_000,
        })
      );
    });
  });
});
