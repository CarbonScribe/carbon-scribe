import type {
  CalculateCreditsRequest,
  CarbonCredit,
  CreateForwardSaleRequest,
  CreditStatusResponse,
  DistributeRevenueRequest,
  ForwardSaleAgreement,
  InitiatePaymentRequest,
  PaymentTransaction,
  RevenueDistribution,
} from "@/lib/api/financing.api";

export type FinancingCreditStatus = CarbonCredit["status"] | "minting" | "retired";
export type FinancingCredit = Omit<CarbonCredit, "status"> & {
  status: FinancingCreditStatus;
};

export type FinancingForwardSaleStatus =
  | ForwardSaleAgreement["status"]
  | "active";

export type FinancingPaymentStatus = PaymentTransaction["status"];

export type FinancingBucketedCredits = {
  minted: FinancingCredit[];
  available: FinancingCredit[];
  retired: FinancingCredit[];
};

export type FinancingBucketedForwardSales = {
  active: ForwardSaleAgreement[];
  pending: ForwardSaleAgreement[];
  completed: ForwardSaleAgreement[];
};

export type FinancingBucketedPayments = {
  history: PaymentTransaction[];
  pending: PaymentTransaction[];
  failed: PaymentTransaction[];
};

export type FinancingLoadingState = {
  isFetchingCredits: boolean;
  isFetchingForwardSales: boolean;
  isFetchingPayments: boolean;
  isFetchingPayouts: boolean;
  isCalculatingCredits: boolean;
  isMintingCredits: boolean;
  isCreatingForwardSale: boolean;
  isInitiatingPayment: boolean;
  isDistributingRevenue: boolean;
  isFetchingCreditStatus: boolean;
};

export type FinancingErrorState = {
  credits: string | null;
  forwardSales: string | null;
  payments: string | null;
  payouts: string | null;
  calculateCredits: string | null;
  mintCredits: string | null;
  createForwardSale: string | null;
  initiatePayment: string | null;
  distributeRevenue: string | null;
  creditStatus: string | null;
};

export type FinancingLastFetchedAt = {
  creditsByProjectId: Record<string, number | undefined>;
  forwardSalesByProjectId: Record<string, number | undefined>;
  paymentsByProjectId: Record<string, number | undefined>;
  payoutsByProjectId: Record<string, number | undefined>;
};

export type FinancingBackgroundRefreshState = {
  enabledProjectIds: Record<string, true | undefined>;
  intervalMs: number;
};

export interface FinancingSlice {
  financingCreditsByProjectId: Record<string, FinancingCredit[] | undefined>;
  financingCreditStatusById: Record<string, CreditStatusResponse | undefined>;
  financingForwardSalesByProjectId: Record<string, ForwardSaleAgreement[] | undefined>;
  financingPaymentsByProjectId: Record<string, PaymentTransaction[] | undefined>;
  financingPayoutsByProjectId: Record<string, RevenueDistribution[] | undefined>;
  financingLoading: FinancingLoadingState;
  financingErrors: FinancingErrorState;
  financingLastFetchedAt: FinancingLastFetchedAt;
  financingBackgroundRefresh: FinancingBackgroundRefreshState;

  fetchFinancingCredits: (
    projectId: string,
    options?: { force?: boolean; maxAgeMs?: number },
  ) => Promise<FinancingCredit[] | null>;
  fetchFinancingForwardSales: (
    projectId: string,
    options?: { force?: boolean; maxAgeMs?: number },
  ) => Promise<ForwardSaleAgreement[] | null>;
  fetchFinancingPayments: (
    projectId: string,
    options?: { force?: boolean; maxAgeMs?: number },
  ) => Promise<PaymentTransaction[] | null>;
  fetchFinancingPayouts: (
    projectId: string,
    options?: { force?: boolean; maxAgeMs?: number },
  ) => Promise<RevenueDistribution[] | null>;

  calculateProjectCredits: (
    projectId: string,
    payload: CalculateCreditsRequest,
  ) => Promise<FinancingCredit | null>;
  mintCreditsOptimistic: (payload: {
    projectId: string;
    creditId: string;
    batchSize?: number;
    issuerAccount?: string;
  }) => Promise<FinancingCredit | null>;
  fetchCreditStatus: (creditId: string) => Promise<CreditStatusResponse | null>;

  createForwardSaleOptimistic: (
    payload: CreateForwardSaleRequest,
  ) => Promise<ForwardSaleAgreement | null>;

  initiatePaymentOptimistic: (
    payload: InitiatePaymentRequest,
  ) => Promise<PaymentTransaction | null>;
  distributeRevenueOptimistic: (
    payload: DistributeRevenueRequest & { projectId?: string },
  ) => Promise<RevenueDistribution | null>;

  getCreditBuckets: (projectId: string) => FinancingBucketedCredits;
  getForwardSaleBuckets: (projectId: string) => FinancingBucketedForwardSales;
  getPaymentBuckets: (projectId: string) => FinancingBucketedPayments;

  startFinancingBackgroundRefresh: (
    projectId: string,
    intervalMs?: number,
  ) => void;
  stopFinancingBackgroundRefresh: (projectId?: string) => void;

  resetFinancingState: () => void;
}

