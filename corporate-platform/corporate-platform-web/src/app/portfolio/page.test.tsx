import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PortfolioPage from '@/app/portfolio/page';
import { portfolioService } from '@/services/portfolio.service';
import { reportError } from '@/lib/telemetry/errorReporter';

const mockFetchPortfolioHoldings = vi.fn();
const mockAnnounce = vi.fn();

vi.mock('@/hooks/useAnnouncement', () => ({
  useAnnouncement: () => ({ announce: mockAnnounce }),
}));

vi.mock('@/lib/telemetry/errorReporter', () => ({
  reportError: vi.fn(),
}));

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
    company: {
      id: 'corp-1',
      name: 'Acme Corp',
    },
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

describe('PortfolioPage Export CSV', () => {
  let clickSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test-uuid');
    window.URL.revokeObjectURL = vi.fn();
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the Export CSV button in idle state with label and icon', () => {
    render(<PortfolioPage />);

    const exportBtn = screen.getByRole('button', { name: /export csv/i });
    expect(exportBtn).toBeInTheDocument();
    expect(exportBtn).not.toBeDisabled();
    expect(exportBtn).toHaveTextContent('Export CSV');
  });

  it('downloads CSV file containing currently displayed recent transactions when Export CSV is clicked', async () => {
    let downloadedFilename = '';
    clickSpy.mockImplementation(function (this: HTMLAnchorElement) {
      downloadedFilename = this.download;
    });

    render(<PortfolioPage />);
    const exportBtn = screen.getByRole('button', { name: /export csv/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1);
    });

    const exportedBlob = (window.URL.createObjectURL as any).mock.calls[0][0] as Blob;
    expect(exportedBlob).toBeInstanceOf(Blob);
    expect(exportedBlob.type).toBe('text/csv;charset=utf-8;');

    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(exportedBlob);
    });

    // Validates CSV content
    expect(text).toContain('ID,Date,Type,Project,Amount,Price,Status');
    expect(text).toContain('Carbon Project 1');
    expect(text).toContain('Carbon Project 10');
    expect(text).toContain('holding-1');
    expect(text).toContain('Purchase');
    expect(text).toContain('100');
    expect(text).toContain('15.5');
    expect(text).toContain('Completed');

    // Validates anchor click, download filename, and revokeObjectURL
    expect(clickSpy).toHaveBeenCalled();
    expect(downloadedFilename).toBe(`acme-corp-transactions-6m-${new Date().toISOString().split('T')[0]}.csv`);
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/test-uuid');
    expect(mockAnnounce).toHaveBeenCalledWith('Export completed successfully', 'polite');
  });

  it('shows loading and disabled state on the button while export is in progress', async () => {
    let resolveExport!: (blob: Blob) => void;
    const exportPromise = new Promise<Blob>((resolve) => {
      resolveExport = resolve;
    });
    vi.spyOn(portfolioService, 'exportTransactionsCsv').mockReturnValue(exportPromise);

    render(<PortfolioPage />);
    const exportBtn = screen.getByRole('button', { name: /export csv/i });
    expect(exportBtn).not.toBeDisabled();

    fireEvent.click(exportBtn);

    // Button should be disabled during export
    expect(exportBtn).toBeDisabled();
    expect(exportBtn).toHaveClass('disabled:opacity-60');

    // Resolve export
    await act(async () => {
      resolveExport(new Blob(['test'], { type: 'text/csv' }));
    });

    await waitFor(() => {
      expect(exportBtn).not.toBeDisabled();
    });
  });

  it('surfaces export failures via role="alert", reportError telemetry, and announcement', async () => {
    vi.spyOn(portfolioService, 'exportTransactionsCsv').mockRejectedValue(
      new Error('Failed to generate export')
    );

    render(<PortfolioPage />);
    const exportBtn = screen.getByRole('button', { name: /export csv/i });
    fireEvent.click(exportBtn);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Failed to generate export');

    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      'PortfolioPage',
      'error',
      { operation: 'exportCsv' }
    );
    expect(mockAnnounce).toHaveBeenCalledWith(
      'Export failed: Failed to generate export',
      'assertive'
    );
    expect(exportBtn).not.toBeDisabled();
  });
});
