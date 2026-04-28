import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  calculateCredits,
  mintCredits,
  getCreditStatus,
  getProjectCredits,
  getCreditTraceability,
  createForwardSale,
  getPriceQuote,
  initiatePayment,
  distributeRevenue,
  getPayoutStatus
} from '@/lib/api/financing.api';
import { api } from '@/lib/api/axios';

// Mock the axios instance
vi.mock('@/lib/api/axios', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe('Financing API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Credit Management', () => {
    it('should calculate credits successfully', async () => {
      const projectId = 'test-project-id';
      const payload = {
        methodology_code: 'AM001',
        vintage_year: 2024,
        period_start: '2024-01-01',
        period_end: '2024-12-31',
        area_hectares: 100,
        monitoring_data: { growth_rate: 2.5 },
        data_quality: 0.8,
      };

      const mockResponse = {
        id: 'credit-123',
        project_id: projectId,
        calculated_tons: 250.5,
        buffered_tons: 25.05,
        issued_tons: 225.45,
        status: 'calculated',
      };

      vi.mocked(api.post).mockResolvedValue({ data: mockResponse });

      const result = await calculateCredits(projectId, payload);

      expect(api.post).toHaveBeenCalledWith(`/financing/projects/${projectId}/calculate`, payload);
      expect(result).toEqual(mockResponse);
    });

    it('should mint credits successfully', async () => {
      const payload = {
        credit_id: 'credit-123',
        batch_size: 225,
      };

      const mockResponse = {
        id: 'credit-123',
        status: 'minting',
        issued_tons: 225,
        token_ids: ['token-1', 'token-2'],
      };

      vi.mocked(api.post).mockResolvedValue({ data: mockResponse });

      const result = await mintCredits(payload);

      expect(api.post).toHaveBeenCalledWith('/financing/credits/mint', payload);
      expect(result).toEqual(mockResponse);
    });

    it('should get credit status successfully', async () => {
      const creditId = 'credit-123';
      const mockResponse = {
        credit_id: creditId,
        status: 'minted',
        mint_transaction_hash: '0xabc123',
        issued_tons: 225,
        minted_at: '2024-01-15T10:00:00Z',
        last_updated_at: '2024-01-15T10:05:00Z',
      };

      vi.mocked(api.get).mockResolvedValue({ data: mockResponse });

      const result = await getCreditStatus(creditId);

      expect(api.get).toHaveBeenCalledWith(`/financing/credits/${creditId}/status`);
      expect(result).toEqual(mockResponse);
    });

    it('should get project credits successfully', async () => {
      const projectId = 'test-project-id';
      const mockResponse = [
        {
          id: 'credit-1',
          project_id: projectId,
          issued_tons: 100,
          status: 'minted',
        },
        {
          id: 'credit-2',
          project_id: projectId,
          issued_tons: 150,
          status: 'calculated',
        },
      ];

      vi.mocked(api.get).mockResolvedValue({ data: mockResponse });

      const result = await getProjectCredits(projectId);

      expect(api.get).toHaveBeenCalledWith(`/financing/projects/${projectId}/credits`);
      expect(result).toEqual(mockResponse);
    });

    it('should get credit traceability successfully', async () => {
      const tokenId = 'token-123';
      const mockResponse = {
        token_id: tokenId,
        project_id: 'project-123',
        methodology_code: 'AM001',
        methodology_token_id: 1,
        vintage_year: 2024,
        mint_transaction: '0xabc123',
        minted_at: '2024-01-15T10:00:00Z',
      };

      vi.mocked(api.get).mockResolvedValue({ data: mockResponse });

      const result = await getCreditTraceability(tokenId);

      expect(api.get).toHaveBeenCalledWith(`/credits/${tokenId}/traceability`);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Forward Sales', () => {
    it('should create forward sale successfully', async () => {
      const payload = {
        project_id: 'project-123',
        buyer_id: 'buyer-123',
        vintage_year: 2024,
        tons_committed: 100,
        price_per_ton: 15.5,
        currency: 'USD',
        delivery_date: '2024-12-31',
        deposit_percent: 10,
      };

      const mockResponse = {
        id: 'sale-123',
        project_id: payload.project_id,
        buyer_id: payload.buyer_id,
        total_amount: 1550,
        status: 'pending',
      };

      vi.mocked(api.post).mockResolvedValue({ data: mockResponse });

      const result = await createForwardSale(payload);

      expect(api.post).toHaveBeenCalledWith('/financing/credits/forward-sale', payload);
      expect(result).toEqual(mockResponse);
    });

    it('should get price quote successfully', async () => {
      const params = {
        methodology_code: 'AM001',
        vintage_year: 2024,
        data_quality: 0.8,
      };

      const mockResponse = {
        methodology_code: 'AM001',
        vintage_year: 2024,
        price_per_ton: 15.5,
        currency: 'USD',
        market_multiplier: 1.2,
        quality_factor: 0.9,
      };

      vi.mocked(api.get).mockResolvedValue({ data: mockResponse });

      const result = await getPriceQuote(params);

      expect(api.get).toHaveBeenCalledWith('/financing/pricing/quote', { params });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Payments and Payouts', () => {
    it('should initiate payment successfully', async () => {
      const payload = {
        project_id: 'project-123',
        amount: 1000,
        currency: 'USD',
        payment_method: 'stripe',
        payment_provider: 'stripe',
      };

      const mockResponse = {
        id: 'payment-123',
        external_id: 'ext-123',
        amount: 1000,
        currency: 'USD',
        status: 'initiated',
      };

      vi.mocked(api.post).mockResolvedValue({ data: mockResponse });

      const result = await initiatePayment(payload);

      expect(api.post).toHaveBeenCalledWith('/financing/payments/initiate', payload);
      expect(result).toEqual(mockResponse);
    });

    it('should distribute revenue successfully', async () => {
      const payload = {
        credit_sale_id: 'sale-123',
        distribution_type: 'revenue_share',
        total_received: 1550,
        currency: 'USD',
        platform_fee_percent: 5,
        beneficiaries: [
          {
            user_id: 'user-1',
            percent: 80,
            amount: 1240,
            tax_withheld: 124,
            payment_route: 'bank_transfer',
          },
          {
            user_id: 'user-2',
            percent: 20,
            amount: 310,
            tax_withheld: 31,
            payment_route: 'stellar',
          },
        ],
      };

      const mockResponse = {
        id: 'payout-123',
        credit_sale_id: payload.credit_sale_id,
        total_received: payload.total_received,
        net_amount: 1472.5,
        payment_status: 'pending',
      };

      vi.mocked(api.post).mockResolvedValue({ data: mockResponse });

      const result = await distributeRevenue(payload);

      expect(api.post).toHaveBeenCalledWith('/financing/payouts/distribute', payload);
      expect(result).toEqual(mockResponse);
    });

    it('should get payout status successfully', async () => {
      const payoutId = 'payout-123';
      const mockResponse = {
        id: payoutId,
        credit_sale_id: 'sale-123',
        total_received: 1550,
        net_amount: 1472.5,
        payment_status: 'completed',
        payment_processed_at: '2024-01-15T10:00:00Z',
      };

      vi.mocked(api.get).mockResolvedValue({ data: mockResponse });

      const result = await getPayoutStatus(payoutId);

      expect(api.get).toHaveBeenCalledWith(`/financing/payouts/${payoutId}`);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const projectId = 'test-project-id';
      const payload = {
        methodology_code: 'AM001',
        vintage_year: 2024,
        period_start: '2024-01-01',
        period_end: '2024-12-31',
        area_hectares: 100,
        monitoring_data: {},
        data_quality: 0.8,
      };

      const error = new Error('API Error');
      (error as any).response = { data: { error: 'Invalid methodology code' } };
      
      vi.mocked(api.post).mockRejectedValue(error);

      await expect(calculateCredits(projectId, payload)).rejects.toThrow('API Error');
    });

    it('should handle network errors', async () => {
      const projectId = 'test-project-id';
      const payload = {
        methodology_code: 'AM001',
        vintage_year: 2024,
        period_start: '2024-01-01',
        period_end: '2024-12-31',
        area_hectares: 100,
        monitoring_data: {},
        data_quality: 0.8,
      };

      const networkError = new Error('Network Error');
      vi.mocked(api.post).mockRejectedValue(networkError);

      await expect(calculateCredits(projectId, payload)).rejects.toThrow('Network Error');
    });
  });
});
