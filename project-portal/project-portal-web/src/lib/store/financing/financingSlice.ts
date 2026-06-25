import type { StateCreator } from "zustand";
import {
  calculateCredits,
  createForwardSale,
  distributeRevenue,
  getCreditStatus,
  getProjectCredits,
  getProjectForwardSales,
  getProjectPayments,
  getProjectPayouts,
  initiatePayment,
  mintCredits,
  type CreditStatusResponse,
  type ForwardSaleAgreement,
  type PaymentTransaction,
  type RevenueDistribution,
} from "@/lib/api/financing.api";
import { getErrorMessage } from "@/lib/utils/errorMessage";
import type {
  FinancingBucketedCredits,
  FinancingBucketedForwardSales,
  FinancingBucketedPayments,
  FinancingCredit,
  FinancingCreditStatus,
  FinancingSlice,
} from "./financing.types";

type RefreshTimerId = ReturnType<typeof setInterval>;

const refreshTimersByProjectId: Record<string, RefreshTimerId | undefined> = {};

const initialState: Pick<
  FinancingSlice,
  | "financingCreditsByProjectId"
  | "financingCreditStatusById"
  | "financingForwardSalesByProjectId"
  | "financingPaymentsByProjectId"
  | "financingPayoutsByProjectId"
  | "financingLoading"
  | "financingErrors"
  | "financingLastFetchedAt"
  | "financingBackgroundRefresh"
> = {
  financingCreditsByProjectId: {},
  financingCreditStatusById: {},
  financingForwardSalesByProjectId: {},
  financingPaymentsByProjectId: {},
  financingPayoutsByProjectId: {},
  financingLoading: {
    isFetchingCredits: false,
    isFetchingForwardSales: false,
    isFetchingPayments: false,
    isFetchingPayouts: false,
    isCalculatingCredits: false,
    isMintingCredits: false,
    isCreatingForwardSale: false,
    isInitiatingPayment: false,
    isDistributingRevenue: false,
    isFetchingCreditStatus: false,
  },
  financingErrors: {
    credits: null,
    forwardSales: null,
    payments: null,
    payouts: null,
    calculateCredits: null,
    mintCredits: null,
    createForwardSale: null,
    initiatePayment: null,
    distributeRevenue: null,
    creditStatus: null,
  },
  financingLastFetchedAt: {
    creditsByProjectId: {},
    forwardSalesByProjectId: {},
    paymentsByProjectId: {},
    payoutsByProjectId: {},
  },
  financingBackgroundRefresh: {
    enabledProjectIds: {},
    intervalMs: 30_000,
  },
};

function nowMs(): number {
  return Date.now();
}

function shouldFetch(
  lastFetchedAt: number | undefined,
  options?: { force?: boolean; maxAgeMs?: number },
): boolean {
  if (options?.force) return true;
  const maxAgeMs = options?.maxAgeMs ?? 30_000;
  if (!lastFetchedAt) return true;
  return nowMs() - lastFetchedAt > maxAgeMs;
}

function bucketCredits(credits: FinancingCredit[]): FinancingBucketedCredits {
  const minted: FinancingCredit[] = [];
  const available: FinancingCredit[] = [];
  const retired: FinancingCredit[] = [];

  for (const c of credits) {
    if (c.status === "retired") {
      retired.push(c);
      continue;
    }
    if (c.status === "verified") {
      available.push(c);
      continue;
    }
    if (c.status === "minted") {
      minted.push(c);
      continue;
    }
    if (c.status === "minting") {
      minted.push(c);
      continue;
    }
  }

  return { minted, available, retired };
}

function bucketForwardSales(
  sales: ForwardSaleAgreement[],
): FinancingBucketedForwardSales {
  const active: ForwardSaleAgreement[] = [];
  const pending: ForwardSaleAgreement[] = [];
  const completed: ForwardSaleAgreement[] = [];

  for (const s of sales) {
    if (s.status === "completed") {
      completed.push(s);
      continue;
    }
    if (s.status === "pending") {
      pending.push(s);
      continue;
    }
    if (s.status === "signed") {
      active.push(s);
      continue;
    }
  }

  return { active, pending, completed };
}

function bucketPayments(
  payments: PaymentTransaction[],
): FinancingBucketedPayments {
  const history: PaymentTransaction[] = [];
  const pending: PaymentTransaction[] = [];
  const failed: PaymentTransaction[] = [];

  for (const p of payments) {
    if (p.status === "failed") {
      failed.push(p);
      continue;
    }
    if (p.status === "completed") {
      history.push(p);
      continue;
    }
    pending.push(p);
  }

  return { history, pending, failed };
}

function asFinancingCreditStatus(value: unknown): FinancingCreditStatus {
  if (typeof value === "string") {
    if (value === "minting") return "minting";
    if (value === "retired") return "retired";
    if (value === "calculated") return "calculated";
    if (value === "minted") return "minted";
    if (value === "verified") return "verified";
    if (value === "pending") return "pending";
  }
  return "pending";
}

function toFinancingCredit(input: any): FinancingCredit {
  const { status, ...rest } = input ?? {};
  return { ...(rest as FinancingCredit), status: asFinancingCreditStatus(status) };
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx === -1) return [item, ...list];
  const next = list.slice();
  next[idx] = item;
  return next;
}

function replaceTempItem<T extends { id: string }>(
  list: T[],
  tempId: string,
  item: T,
): T[] {
  const idx = list.findIndex((x) => x.id === tempId);
  if (idx === -1) return upsertById(list, item);
  const next = list.slice();
  next[idx] = item;
  return next;
}

export const createFinancingSlice: StateCreator<FinancingSlice> = (set, get) => ({
  ...initialState,

  fetchFinancingCredits: async (projectId, options) => {
    const lastFetchedAt = get().financingLastFetchedAt.creditsByProjectId[projectId];
    if (!shouldFetch(lastFetchedAt, options)) {
      return (get().financingCreditsByProjectId[projectId] ?? null) as FinancingCredit[] | null;
    }

    set((state) => ({
      financingLoading: { ...state.financingLoading, isFetchingCredits: true },
      financingErrors: { ...state.financingErrors, credits: null },
    }));

    try {
      const credits = await getProjectCredits(projectId);
      const normalized = credits.map(toFinancingCredit);
      set((state) => ({
        financingCreditsByProjectId: {
          ...state.financingCreditsByProjectId,
          [projectId]: normalized,
        },
        financingLastFetchedAt: {
          ...state.financingLastFetchedAt,
          creditsByProjectId: {
            ...state.financingLastFetchedAt.creditsByProjectId,
            [projectId]: nowMs(),
          },
        },
        financingLoading: { ...state.financingLoading, isFetchingCredits: false },
      }));
      return normalized;
    } catch (error: unknown) {
      set((state) => ({
        financingLoading: { ...state.financingLoading, isFetchingCredits: false },
        financingErrors: { ...state.financingErrors, credits: getErrorMessage(error) },
      }));
      return null;
    }
  },

  fetchFinancingForwardSales: async (projectId, options) => {
    const lastFetchedAt =
      get().financingLastFetchedAt.forwardSalesByProjectId[projectId];
    if (!shouldFetch(lastFetchedAt, options)) {
      return get().financingForwardSalesByProjectId[projectId] ?? null;
    }

    set((state) => ({
      financingLoading: { ...state.financingLoading, isFetchingForwardSales: true },
      financingErrors: { ...state.financingErrors, forwardSales: null },
    }));

    try {
      const sales = await getProjectForwardSales(projectId);
      set((state) => ({
        financingForwardSalesByProjectId: {
          ...state.financingForwardSalesByProjectId,
          [projectId]: sales,
        },
        financingLastFetchedAt: {
          ...state.financingLastFetchedAt,
          forwardSalesByProjectId: {
            ...state.financingLastFetchedAt.forwardSalesByProjectId,
            [projectId]: nowMs(),
          },
        },
        financingLoading: {
          ...state.financingLoading,
          isFetchingForwardSales: false,
        },
      }));
      return sales;
    } catch (error: unknown) {
      set((state) => ({
        financingLoading: {
          ...state.financingLoading,
          isFetchingForwardSales: false,
        },
        financingErrors: {
          ...state.financingErrors,
          forwardSales: getErrorMessage(error),
        },
      }));
      return null;
    }
  },

  fetchFinancingPayments: async (projectId, options) => {
    const lastFetchedAt = get().financingLastFetchedAt.paymentsByProjectId[projectId];
    if (!shouldFetch(lastFetchedAt, options)) {
      return get().financingPaymentsByProjectId[projectId] ?? null;
    }

    set((state) => ({
      financingLoading: { ...state.financingLoading, isFetchingPayments: true },
      financingErrors: { ...state.financingErrors, payments: null },
    }));

    try {
      const payments = await getProjectPayments(projectId);
      set((state) => ({
        financingPaymentsByProjectId: {
          ...state.financingPaymentsByProjectId,
          [projectId]: payments,
        },
        financingLastFetchedAt: {
          ...state.financingLastFetchedAt,
          paymentsByProjectId: {
            ...state.financingLastFetchedAt.paymentsByProjectId,
            [projectId]: nowMs(),
          },
        },
        financingLoading: { ...state.financingLoading, isFetchingPayments: false },
      }));
      return payments;
    } catch (error: unknown) {
      set((state) => ({
        financingLoading: { ...state.financingLoading, isFetchingPayments: false },
        financingErrors: { ...state.financingErrors, payments: getErrorMessage(error) },
      }));
      return null;
    }
  },

  fetchFinancingPayouts: async (projectId, options) => {
    const lastFetchedAt = get().financingLastFetchedAt.payoutsByProjectId[projectId];
    if (!shouldFetch(lastFetchedAt, options)) {
      return get().financingPayoutsByProjectId[projectId] ?? null;
    }

    set((state) => ({
      financingLoading: { ...state.financingLoading, isFetchingPayouts: true },
      financingErrors: { ...state.financingErrors, payouts: null },
    }));

    try {
      const payouts = await getProjectPayouts(projectId);
      set((state) => ({
        financingPayoutsByProjectId: {
          ...state.financingPayoutsByProjectId,
          [projectId]: payouts,
        },
        financingLastFetchedAt: {
          ...state.financingLastFetchedAt,
          payoutsByProjectId: {
            ...state.financingLastFetchedAt.payoutsByProjectId,
            [projectId]: nowMs(),
          },
        },
        financingLoading: { ...state.financingLoading, isFetchingPayouts: false },
      }));
      return payouts;
    } catch (error: unknown) {
      set((state) => ({
        financingLoading: { ...state.financingLoading, isFetchingPayouts: false },
        financingErrors: { ...state.financingErrors, payouts: getErrorMessage(error) },
      }));
      return null;
    }
  },

  calculateProjectCredits: async (projectId, payload) => {
    set((state) => ({
      financingLoading: { ...state.financingLoading, isCalculatingCredits: true },
      financingErrors: { ...state.financingErrors, calculateCredits: null },
    }));

    try {
      const credit = await calculateCredits(projectId, payload);
      const normalized = toFinancingCredit(credit);
      set((state) => {
        const existing = state.financingCreditsByProjectId[projectId] ?? [];
        return {
          financingCreditsByProjectId: {
            ...state.financingCreditsByProjectId,
            [projectId]: upsertById(existing, normalized),
          },
          financingLoading: {
            ...state.financingLoading,
            isCalculatingCredits: false,
          },
        };
      });
      return normalized;
    } catch (error: unknown) {
      set((state) => ({
        financingLoading: { ...state.financingLoading, isCalculatingCredits: false },
        financingErrors: {
          ...state.financingErrors,
          calculateCredits: getErrorMessage(error),
        },
      }));
      return null;
    }
  },

  mintCreditsOptimistic: async ({ projectId, creditId, batchSize, issuerAccount }) => {
    set((state) => ({
      financingLoading: { ...state.financingLoading, isMintingCredits: true },
      financingErrors: { ...state.financingErrors, mintCredits: null },
    }));

    const prevCredits = get().financingCreditsByProjectId[projectId] ?? [];
    const optimistic: FinancingCredit | null =
      prevCredits.find((c) => c.id === creditId)
        ? {
            ...(prevCredits.find((c) => c.id === creditId) as FinancingCredit),
            status: "minting",
          }
        : null;

    if (optimistic) {
      set((state) => ({
        financingCreditsByProjectId: {
          ...state.financingCreditsByProjectId,
          [projectId]: upsertById(prevCredits, optimistic),
        },
      }));
    }

    try {
      const minted = await mintCredits({
        credit_id: creditId,
        batch_size: batchSize,
        issuer_account: issuerAccount,
      });
      const normalized = toFinancingCredit(minted);
      set((state) => {
        const existing = state.financingCreditsByProjectId[projectId] ?? [];
        return {
          financingCreditsByProjectId: {
            ...state.financingCreditsByProjectId,
            [projectId]: upsertById(existing, normalized),
          },
          financingLoading: { ...state.financingLoading, isMintingCredits: false },
        };
      });
      return normalized;
    } catch (error: unknown) {
      set((state) => ({
        financingCreditsByProjectId: {
          ...state.financingCreditsByProjectId,
          [projectId]: prevCredits,
        },
        financingLoading: { ...state.financingLoading, isMintingCredits: false },
        financingErrors: { ...state.financingErrors, mintCredits: getErrorMessage(error) },
      }));
      return null;
    }
  },

  fetchCreditStatus: async (creditId) => {
    set((state) => ({
      financingLoading: { ...state.financingLoading, isFetchingCreditStatus: true },
      financingErrors: { ...state.financingErrors, creditStatus: null },
    }));

    try {
      const status = await getCreditStatus(creditId);
      set((state) => ({
        financingCreditStatusById: {
          ...state.financingCreditStatusById,
          [creditId]: status,
        },
        financingLoading: {
          ...state.financingLoading,
          isFetchingCreditStatus: false,
        },
      }));
      return status;
    } catch (error: unknown) {
      set((state) => ({
        financingLoading: {
          ...state.financingLoading,
          isFetchingCreditStatus: false,
        },
        financingErrors: {
          ...state.financingErrors,
          creditStatus: getErrorMessage(error),
        },
      }));
      return null;
    }
  },

  createForwardSaleOptimistic: async (payload) => {
    const projectId = payload.project_id;
    const tempId = `temp-sale-${nowMs()}-${Math.random().toString(16).slice(2)}`;
    const optimistic: ForwardSaleAgreement = {
      ...(payload as any),
      id: tempId,
      total_amount: payload.tons_committed * payload.price_per_ton,
      contract_hash: "",
      deposit_paid: payload.deposit_paid ?? false,
      deposit_transaction_id: "",
      payment_schedule: payload.payment_schedule ?? {},
      deposit_external_id: payload.deposit_external_id,
      signed_by_seller_at: payload.signed_by_seller ? new Date().toISOString() : undefined,
      signed_by_buyer_at: payload.signed_by_buyer ? new Date().toISOString() : undefined,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    set((state) => ({
      financingLoading: { ...state.financingLoading, isCreatingForwardSale: true },
      financingErrors: { ...state.financingErrors, createForwardSale: null },
      financingForwardSalesByProjectId: {
        ...state.financingForwardSalesByProjectId,
        [projectId]: [
          ...(state.financingForwardSalesByProjectId[projectId] ?? []),
          optimistic,
        ],
      },
    }));

    try {
      const created = await createForwardSale(payload);
      set((state) => ({
        financingForwardSalesByProjectId: {
          ...state.financingForwardSalesByProjectId,
          [projectId]: replaceTempItem(
            state.financingForwardSalesByProjectId[projectId] ?? [],
            tempId,
            created,
          ),
        },
        financingLoading: { ...state.financingLoading, isCreatingForwardSale: false },
      }));
      return created;
    } catch (error: unknown) {
      set((state) => ({
        financingForwardSalesByProjectId: {
          ...state.financingForwardSalesByProjectId,
          [projectId]: (state.financingForwardSalesByProjectId[projectId] ?? []).filter(
            (s) => s.id !== tempId,
          ),
        },
        financingLoading: { ...state.financingLoading, isCreatingForwardSale: false },
        financingErrors: {
          ...state.financingErrors,
          createForwardSale: getErrorMessage(error),
        },
      }));
      return null;
    }
  },

  initiatePaymentOptimistic: async (payload) => {
    const projectId = payload.project_id ?? "global";
    const tempId = `temp-payment-${nowMs()}-${Math.random().toString(16).slice(2)}`;
    const optimistic: PaymentTransaction = {
      id: tempId,
      external_id: tempId,
      user_id: payload.user_id,
      project_id: payload.project_id,
      amount: payload.amount,
      currency: payload.currency,
      payment_method: payload.payment_method,
      payment_provider: payload.payment_provider,
      status: "initiated",
      provider_status: {},
      metadata: payload.metadata ?? {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    set((state) => ({
      financingLoading: { ...state.financingLoading, isInitiatingPayment: true },
      financingErrors: { ...state.financingErrors, initiatePayment: null },
      financingPaymentsByProjectId: {
        ...state.financingPaymentsByProjectId,
        [projectId]: [optimistic, ...(state.financingPaymentsByProjectId[projectId] ?? [])],
      },
    }));

    try {
      const created = await initiatePayment(payload);
      set((state) => ({
        financingPaymentsByProjectId: {
          ...state.financingPaymentsByProjectId,
          [projectId]: replaceTempItem(
            state.financingPaymentsByProjectId[projectId] ?? [],
            tempId,
            created,
          ),
        },
        financingLoading: { ...state.financingLoading, isInitiatingPayment: false },
      }));
      return created;
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      set((state) => ({
        financingPaymentsByProjectId: {
          ...state.financingPaymentsByProjectId,
          [projectId]: (state.financingPaymentsByProjectId[projectId] ?? []).map((p) =>
            p.id === tempId
              ? ({ ...p, status: "failed", failure_reason: message } as any)
              : p,
          ),
        },
        financingLoading: { ...state.financingLoading, isInitiatingPayment: false },
        financingErrors: { ...state.financingErrors, initiatePayment: message },
      }));
      return null;
    }
  },

  distributeRevenueOptimistic: async (payload) => {
    const projectId = payload.projectId ?? "global";
    const tempId = `temp-payout-${nowMs()}-${Math.random().toString(16).slice(2)}`;
    const optimistic: RevenueDistribution = {
      id: tempId,
      credit_sale_id: payload.credit_sale_id,
      distribution_type: payload.distribution_type,
      total_received: payload.total_received,
      currency: payload.currency,
      platform_fee_percent: payload.platform_fee_percent,
      platform_fee_amount: (payload.total_received * payload.platform_fee_percent) / 100,
      net_amount:
        payload.total_received -
        (payload.total_received * payload.platform_fee_percent) / 100,
      beneficiaries: payload.beneficiaries,
      payment_batch_id: payload.payment_batch_id ?? "",
      payment_status: "pending",
      created_at: new Date().toISOString(),
    };

    set((state) => ({
      financingLoading: { ...state.financingLoading, isDistributingRevenue: true },
      financingErrors: { ...state.financingErrors, distributeRevenue: null },
      financingPayoutsByProjectId: {
        ...state.financingPayoutsByProjectId,
        [projectId]: [optimistic, ...(state.financingPayoutsByProjectId[projectId] ?? [])],
      },
    }));

    try {
      const created = await distributeRevenue(payload);
      set((state) => ({
        financingPayoutsByProjectId: {
          ...state.financingPayoutsByProjectId,
          [projectId]: replaceTempItem(
            state.financingPayoutsByProjectId[projectId] ?? [],
            tempId,
            created,
          ),
        },
        financingLoading: {
          ...state.financingLoading,
          isDistributingRevenue: false,
        },
      }));
      return created;
    } catch (error: unknown) {
      set((state) => ({
        financingPayoutsByProjectId: {
          ...state.financingPayoutsByProjectId,
          [projectId]: (state.financingPayoutsByProjectId[projectId] ?? []).filter(
            (p) => p.id !== tempId,
          ),
        },
        financingLoading: {
          ...state.financingLoading,
          isDistributingRevenue: false,
        },
        financingErrors: {
          ...state.financingErrors,
          distributeRevenue: getErrorMessage(error),
        },
      }));
      return null;
    }
  },

  getCreditBuckets: (projectId) => {
    const credits = get().financingCreditsByProjectId[projectId] ?? [];
    return bucketCredits(credits);
  },

  getForwardSaleBuckets: (projectId) => {
    const sales = get().financingForwardSalesByProjectId[projectId] ?? [];
    return bucketForwardSales(sales);
  },

  getPaymentBuckets: (projectId) => {
    const payments = get().financingPaymentsByProjectId[projectId] ?? [];
    return bucketPayments(payments);
  },

  startFinancingBackgroundRefresh: (projectId, intervalMs) => {
    if (typeof window === "undefined") return;
    const effectiveIntervalMs =
      intervalMs ?? get().financingBackgroundRefresh.intervalMs;

    get().stopFinancingBackgroundRefresh(projectId);

    refreshTimersByProjectId[projectId] = setInterval(() => {
      const state = get();
      state.fetchFinancingCredits(projectId, { force: true }).catch(() => {});
      state.fetchFinancingForwardSales(projectId, { force: true }).catch(() => {});
      state.fetchFinancingPayments(projectId, { force: true }).catch(() => {});
      state.fetchFinancingPayouts(projectId, { force: true }).catch(() => {});
    }, effectiveIntervalMs);

    set((state) => ({
      financingBackgroundRefresh: {
        enabledProjectIds: {
          ...state.financingBackgroundRefresh.enabledProjectIds,
          [projectId]: true,
        },
        intervalMs: effectiveIntervalMs,
      },
    }));
  },

  stopFinancingBackgroundRefresh: (projectId) => {
    const ids = projectId ? [projectId] : Object.keys(refreshTimersByProjectId);
    for (const id of ids) {
      const timer = refreshTimersByProjectId[id];
      if (timer) {
        clearInterval(timer);
      }
      delete refreshTimersByProjectId[id];
    }

    set((state) => {
      if (!projectId) {
        return {
          financingBackgroundRefresh: {
            ...state.financingBackgroundRefresh,
            enabledProjectIds: {},
          },
        };
      }
      const nextEnabled = { ...state.financingBackgroundRefresh.enabledProjectIds };
      delete nextEnabled[projectId];
      return {
        financingBackgroundRefresh: {
          ...state.financingBackgroundRefresh,
          enabledProjectIds: nextEnabled,
        },
      };
    });
  },

  resetFinancingState: () => {
    get().stopFinancingBackgroundRefresh();
    set({ ...initialState });
  },
});
