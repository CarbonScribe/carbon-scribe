import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import StoreHydrator from "@/components/StoreHydrator";
import { showErrorToast } from "@/lib/utils/toast";
import { fetchNotificationsApi } from "@/store/notification.api";

vi.mock("@/lib/utils/toast", () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
  showInfoToast: vi.fn(),
  showWarningToast: vi.fn(),
}));

describe("Global 5xx Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a branded toast and prevents default on unhandled 5xx rejections", () => {
    const addSpy = vi.spyOn(window, "addEventListener");

    render(React.createElement(StoreHydrator));

    const handler = addSpy.mock.calls.find(
      (c) => c[0] === "unhandledrejection",
    )?.[1] as any;

    expect(handler).toBeTypeOf("function");

    const preventDefault = vi.fn();
    handler({
      reason: { response: { status: 500 } },
      preventDefault,
    } as any);

    expect(showErrorToast).toHaveBeenCalledWith(
      "CarbonScribe is having trouble",
      expect.objectContaining({ id: "global-5xx" }),
    );
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it("does not show the branded toast for non-5xx unhandled rejections", () => {
    const addSpy = vi.spyOn(window, "addEventListener");

    render(React.createElement(StoreHydrator));

    const handler = addSpy.mock.calls.find(
      (c) => c[0] === "unhandledrejection",
    )?.[1] as any;

    handler({
      reason: { response: { status: 400 } },
      preventDefault: vi.fn(),
    } as any);

    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it("shows a branded toast for fetch-based 5xx responses", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue(
      new Response("", { status: 500, statusText: "Internal Server Error" }),
    ) as any;

    await expect(fetchNotificationsApi()).rejects.toBeInstanceOf(Error);

    expect(showErrorToast).toHaveBeenCalledWith(
      "CarbonScribe is having trouble",
      expect.objectContaining({ id: "global-5xx" }),
    );

    global.fetch = originalFetch as any;
  });
});

