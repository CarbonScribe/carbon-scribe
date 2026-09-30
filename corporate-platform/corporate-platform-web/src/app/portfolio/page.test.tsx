import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PortfolioPage from '@/app/portfolio/page';

const mockFetchPortfolioHoldings = vi.fn();

const mockHoldings = Array.from({ length: 25 }, (_, i) => ({
  id: `holding-${i + 1}`,
  quantity: 100 * (i + 1),
  purchasePrice: 15.5,
  currentValue: 16.0,
  purchaseDate: '2026-01-15T00:00:00.000Z',
  credit: {
    id: `credit-${i + 1}`,
    projectName: `Carbon Project ${i + 1}`,
  },
}));

vi.mock('@/contexts/CorporateContext', () => ({
  useCorporate: () => ({
    portfolioSummary: {
      totalRetired: 1000,
      availableBalance: 5000,
      quarterlyGrowth: 12.5,
      netZeroProgress: 68,
      scope3Coverage: 40,
      sdgAlignment: 9,
      costEfficiency: 92,
      lastUpdatedAt: '2026-01-01',
    },
    portfolioAnalytics: {
      summary: { totalRetired: 1000 },
      performance: {
        portfolioValue: 1650000,
        avgPricePerTon: 15.5,
        creditsHeld: 5000,
        projectDiversity: 8,
        performanceTrends: [],
        monthlyRetirements: [],
      },
      composition: {
        methodologyDistribution: [{ name: 'Reforestation', value: 40, percentage: 40 }],
        geographicAllocation: [],
        sdgImpact: [],
        vintageYearDistribution: [],
        projectTypeClassification: [],
      },
      timeline: {
        portfolioGrowth: { monthly: [{ date: 'Jan', value: 100 }] },
        retirementTrends: { monthly: [{ date: 'Jan', value: 50 }] },
        valueOverTime: {},
      },
      risk: {
        diversificationScore: 85,
        riskRating: 'Low',
        concentrationAnalysis: {},
        volatility: 5,
      },
      generatedAt: '2026-01-01',
    },
    portfolioHoldings: mockHoldings.slice(0, 10),
    portfolioHoldingsPagination: {
      total: 25,
      page: 1,
      pageSize: 10,
      pages: 3,
    },
    fetchPortfolioHoldings: mockFetchPortfolioHoldings,
    portfolioLoading: false,
    portfolioError: null,
  }),
}));

// Mock recharts ResponsiveContainer
vi.mock('recharts', async () => {
  const actual = await vi.importActual<any>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  };
});

describe('PortfolioPage Pagination & Virtualization', () => {
  it('renders transactions table and pagination controls', () => {
    render(<PortfolioPage />);

    expect(screen.getByText('Carbon Project 1')).toBeInTheDocument();
    expect(screen.getByText('Carbon Project 10')).toBeInTheDocument();
    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Showing 1 to 10 of 25 transactions');
  });

  it('triggers fetchPortfolioHoldings on page navigation', () => {
    render(<PortfolioPage />);

    const nextButton = screen.getByRole('button', { name: /next page/i });
    fireEvent.click(nextButton);

    expect(mockFetchPortfolioHoldings).toHaveBeenCalledWith({ page: 2, pageSize: 10 });
  });

  it('triggers fetchPortfolioHoldings on page size change', () => {
    render(<PortfolioPage />);

    const select = screen.getByLabelText(/select rows per page for transactions/i);
    fireEvent.change(select, { target: { value: '20' } });

    expect(mockFetchPortfolioHoldings).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });
});
