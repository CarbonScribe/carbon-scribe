import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createFinancingSlice } from "./financingSlice";
import type { FinancingSlice } from "./financing.types";
import * as api from "@/lib/api/financing.api";

vi.mock("@/lib/api/financing.api", () => ({
  calculateCredits: vi.fn(),
  getProjectCredits: vi.fn(),
  mintCredits: vi.fn(),
  getCreditStatus: vi.fn(),
  createForwardSale: vi.fn(),
  getProjectForwardSales: vi.fn(),
  initiatePayment: vi.fn(),
  getProjectPayments: vi.fn(),
  distributeRevenue: vi.fn(),
  getProjectPayouts: vi.fn(),
}));

const mockApi = vi.mocked(api);

describe("FinancingSlice", () => {
  let slice: FinancingSlice;
  let mockSet: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSet = vi.fn((update) => {
      if (typeof update === "function") {
        const next = update(slice);
        Object.assign(slice, next);
      } else {
        Object.assign(slice, update);
      }
    });
    slice = createFinancingSlice(mockSet, () => slice, {} as any);
  });

  afterEach(() => {
    slice.stopFinancingBackgroundRefresh();
  });

  it("fetches credits and caches by project", async () => {
    mockApi.getProjectCredits.mockResolvedValue([
      { id: "c1", issued_tons: 10, status: "minted" },
    ] as any);

    const result = await slice.fetchFinancingCredits("p1", { force: true });

    expect(mockApi.getProjectCredits).toHaveBeenCalledWith("p1");
    expect(result?.[0].id).toBe("c1");
    expect(slice.financingCreditsByProjectId.p1?.[0].id).toBe("c1");
  });

  it("calculates credits and upserts into project cache", async () => {
    mockApi.calculateCredits.mockResolvedValue({
      id: "c2",
      issued_tons: 5,
      status: "calculated",
    } as any);

    const created = await slice.calculateProjectCredits("p1", {
      methodology_code: "AM001",
      vintage_year: 2024,
      period_start: "2024-01-01",
      period_end: "2024-12-31",
      area_hectares: 10,
      data_quality: 0.9,
    } as any);

    expect(mockApi.calculateCredits).toHaveBeenCalled();
    expect(created?.id).toBe("c2");
    expect(slice.financingCreditsByProjectId.p1?.some((c) => c.id === "c2")).toBe(true);
  });

  it("mints credits with optimistic status and finalizes on success", async () => {
    slice.financingCreditsByProjectId = {
      p1: [{ id: "c2", issued_tons: 5, status: "calculated" } as any],
    };

    mockApi.mintCredits.mockResolvedValue({
      id: "c2",
      issued_tons: 5,
      status: "minted",
    } as any);

    const minted = await slice.mintCreditsOptimistic({
      projectId: "p1",
      creditId: "c2",
      batchSize: 5,
    });

    expect(mockApi.mintCredits).toHaveBeenCalledWith({
      credit_id: "c2",
      batch_size: 5,
      issuer_account: undefined,
    });
    expect(minted?.status).toBe("minted");
    expect(slice.financingCreditsByProjectId.p1?.find((c) => c.id === "c2")?.status).toBe(
      "minted",
    );
  });

  it("rolls back optimistic mint on failure", async () => {
    slice.financingCreditsByProjectId = {
      p1: [{ id: "c2", issued_tons: 5, status: "calculated" } as any],
    };

    mockApi.mintCredits.mockRejectedValue(new Error("boom"));

    const minted = await slice.mintCreditsOptimistic({
      projectId: "p1",
      creditId: "c2",
      batchSize: 5,
    });

    expect(minted).toBeNull();
    expect(slice.financingCreditsByProjectId.p1?.find((c) => c.id === "c2")?.status).toBe(
      "calculated",
    );
    expect(slice.financingErrors.mintCredits).toBeTruthy();
  });

  it("marks optimistic payment as failed on error", async () => {
    mockApi.initiatePayment.mockRejectedValue(new Error("payment failed"));

    const created = await slice.initiatePaymentOptimistic({
      project_id: "p1",
      amount: 100,
      currency: "USD",
      payment_method: "stripe",
      payment_provider: "stripe",
    } as any);

    expect(created).toBeNull();
    expect(slice.financingPaymentsByProjectId.p1?.[0].status).toBe("failed");
  });

  it("runs background refresh when enabled", async () => {
    vi.useFakeTimers();
    const creditsSpy = vi.fn().mockResolvedValue(null);
    const salesSpy = vi.fn().mockResolvedValue(null);
    const paymentsSpy = vi.fn().mockResolvedValue(null);
    const payoutsSpy = vi.fn().mockResolvedValue(null);

    (slice as any).fetchFinancingCredits = creditsSpy;
    (slice as any).fetchFinancingForwardSales = salesSpy;
    (slice as any).fetchFinancingPayments = paymentsSpy;
    (slice as any).fetchFinancingPayouts = payoutsSpy;

    slice.startFinancingBackgroundRefresh("p1", 1000);
    vi.advanceTimersByTime(1000);

    expect(creditsSpy).toHaveBeenCalledWith("p1", { force: true });
    expect(salesSpy).toHaveBeenCalledWith("p1", { force: true });
    expect(paymentsSpy).toHaveBeenCalledWith("p1", { force: true });
    expect(payoutsSpy).toHaveBeenCalledWith("p1", { force: true });

    slice.stopFinancingBackgroundRefresh("p1");
    vi.useRealTimers();
  });
});

