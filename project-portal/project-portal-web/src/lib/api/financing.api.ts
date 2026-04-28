import { api } from "./axios";

// Types based on backend models
export interface CarbonCredit {
  id: string;
  project_id: string;
  vintage_year: number;
  calculation_period_start: string;
  calculation_period_end: string;
  methodology_code: string;
  methodology_token_id: number;
  calculated_tons: number;
  buffered_tons: number;
  issued_tons: number;
  data_quality_score: number;
  calculation_inputs: Record<string, any>;
  calculation_audit_trail: Record<string, any>;
  stellar_asset_code: string;
  stellar_asset_issuer: string;
  token_ids: string[];
  mint_transaction_hash: string;
  minted_at?: string;
  status: 'calculated' | 'minted' | 'verified' | 'pending';
  verification_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ForwardSaleAgreement {
  id: string;
  project_id: string;
  buyer_id: string;
  vintage_year: number;
  tons_committed: number;
  price_per_ton: number;
  currency: string;
  total_amount: number;
  delivery_date: string;
  deposit_percent: number;
  deposit_paid: boolean;
  deposit_transaction_id: string;
  payment_schedule: Record<string, any>;
  contract_hash: string;
  signed_by_seller_at?: string;
  signed_by_buyer_at?: string;
  status: 'pending' | 'signed' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface RevenueDistribution {
  id: string;
  credit_sale_id: string;
  distribution_type: string;
  total_received: number;
  currency: string;
  platform_fee_percent: number;
  platform_fee_amount: number;
  net_amount: number;
  beneficiaries: BeneficiarySplit[];
  payment_batch_id: string;
  payment_status: 'pending' | 'processing' | 'completed' | 'failed';
  payment_processed_at?: string;
  created_at: string;
}

export interface PaymentTransaction {
  id: string;
  external_id: string;
  user_id?: string;
  project_id?: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_provider: string;
  status: 'initiated' | 'processing' | 'completed' | 'failed';
  provider_status: Record<string, any>;
  failure_reason?: string;
  stellar_transaction_hash?: string;
  stellar_asset_code?: string;
  stellar_asset_issuer?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface BeneficiarySplit {
  user_id: string;
  percent: number;
  amount: number;
  tax_withheld: number;
  payment_route: string;
}

export interface PricingQuoteResponse {
  methodology_code: string;
  region_code: string;
  vintage_year: number;
  price_per_ton: number;
  currency: string;
  market_multiplier: number;
  quality_factor: number;
}

export interface CreditStatusResponse {
  credit_id: string;
  status: string;
  mint_transaction_hash?: string;
  issued_tons: number;
  minted_at?: string;
  last_updated_at: string;
}

export interface TraceabilityResponse {
  token_id: string;
  project_id: string;
  methodology_code: string;
  methodology_token_id: number;
  vintage_year: number;
  mint_transaction: string;
  minted_at: string;
}

// Request types
export interface CalculateCreditsRequest {
  methodology_code: string;
  vintage_year: number;
  period_start: string;
  period_end: string;
  area_hectares: number;
  monitoring_data?: Record<string, number>;
  data_quality: number;
}

export interface MintCreditsRequest {
  credit_id: string;
  batch_size?: number;
  issuer_account?: string;
}

export interface CreateForwardSaleRequest {
  project_id: string;
  buyer_id: string;
  vintage_year: number;
  tons_committed: number;
  price_per_ton: number;
  currency?: string;
  delivery_date: string;
  deposit_percent: number;
  payment_schedule?: Record<string, any>;
  contract_hash?: string;
  signed_by_seller?: boolean;
  signed_by_buyer?: boolean;
  deposit_paid?: boolean;
  deposit_external_id?: string;
}

export interface InitiatePaymentRequest {
  user_id?: string;
  project_id?: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_provider: string;
  metadata?: Record<string, any>;
}

export interface DistributeRevenueRequest {
  credit_sale_id: string;
  distribution_type: string;
  total_received: number;
  currency: string;
  platform_fee_percent: number;
  beneficiaries: BeneficiarySplit[];
  payment_batch_id?: string;
}

export interface PricingQuoteRequest {
  methodology_code: string;
  region_code?: string;
  vintage_year?: number;
  data_quality?: number;
}

// API Methods
export async function calculateCredits(projectId: string, payload: CalculateCreditsRequest): Promise<CarbonCredit> {
  const res = await api.post(`/financing/projects/${projectId}/calculate`, payload);
  return res.data;
}

export async function getProjectCredits(projectId: string): Promise<CarbonCredit[]> {
  const res = await api.get(`/financing/projects/${projectId}/credits`);
  return res.data;
}

export async function mintCredits(payload: MintCreditsRequest): Promise<CarbonCredit> {
  const res = await api.post('/financing/credits/mint', payload);
  return res.data;
}

export async function getCreditStatus(creditId: string): Promise<CreditStatusResponse> {
  const res = await api.get(`/financing/credits/${creditId}/status`);
  return res.data;
}

export async function getCreditTraceability(tokenId: string): Promise<TraceabilityResponse> {
  const res = await api.get(`/credits/${tokenId}/traceability`);
  return res.data;
}

export async function getCreditsByMethodology(projectId: string, methodologyId: number): Promise<CarbonCredit[]> {
  const res = await api.get(`/projects/${projectId}/credits/methodology/${methodologyId}`);
  return res.data;
}

export async function createForwardSale(payload: CreateForwardSaleRequest): Promise<ForwardSaleAgreement> {
  const res = await api.post('/financing/credits/forward-sale', payload);
  return res.data;
}

export async function getPriceQuote(params: PricingQuoteRequest): Promise<PricingQuoteResponse> {
  const res = await api.get('/financing/pricing/quote', { params });
  return res.data;
}

export async function initiatePayment(payload: InitiatePaymentRequest): Promise<PaymentTransaction> {
  const res = await api.post('/financing/payments/initiate', payload);
  return res.data;
}

export async function distributeRevenue(payload: DistributeRevenueRequest): Promise<RevenueDistribution> {
  const res = await api.post('/financing/payouts/distribute', payload);
  return res.data;
}

export async function getPayoutStatus(payoutId: string): Promise<RevenueDistribution> {
  const res = await api.get(`/financing/payouts/${payoutId}`);
  return res.data;
}
