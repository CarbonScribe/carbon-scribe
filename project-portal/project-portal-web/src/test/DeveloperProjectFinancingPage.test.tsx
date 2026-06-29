import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DeveloperProjectFinancingPage from '@/app/(portal)/developer/projects/[id]/financing/page';
import { useStore } from '@/lib/store/store';

// Mock subcomponents
vi.mock('@/components/financing/TokenizationStatus', () => ({
  default: ({ projectId }: { projectId: string }) => (
    <div data-testid="mock-tokenization-status">TokenizationStatus for {projectId}</div>
  ),
}));
vi.mock('@/components/financing/TokenizationWizard', () => ({
  default: ({ projectId }: { projectId: string }) => (
    <div data-testid="mock-tokenization-wizard">TokenizationWizard for {projectId}</div>
  ),
}));
vi.mock('@/components/financing/ForwardSale', () => ({
  default: ({ projectId }: { projectId: string }) => (
    <div data-testid="mock-forward-sale">ForwardSale for {projectId}</div>
  ),
}));
vi.mock('@/components/financing/PaymentManagement', () => ({
  default: ({ projectId }: { projectId: string }) => (
    <div data-testid="mock-payment-management">PaymentManagement for {projectId}</div>
  ),
}));

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/developer/projects/project-123/financing',
  useParams: () => ({ id: 'project-123' }),
}));

const mockFetchProjectById = vi.fn(() => Promise.resolve() as Promise<void>);
const mockFetchCredits = vi.fn(() => Promise.resolve(null) as Promise<any>);
const mockFetchForwardSales = vi.fn(() => Promise.resolve(null) as Promise<any>);
const mockFetchPayments = vi.fn(() => Promise.resolve(null) as Promise<any>);
const mockFetchPayouts = vi.fn(() => Promise.resolve(null) as Promise<any>);
const mockStartFinancingBackgroundRefresh = vi.fn();
const mockStopFinancingBackgroundRefresh = vi.fn();

const defaultStoreState = {
  // Projects slice
  selectedProject: null,
  loading: {
    isFetching: false,
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
  },
  errors: {
    fetch: null,
    create: null,
    update: null,
    delete: null,
  },
  fetchProjectById: mockFetchProjectById,

  // Financing slice
  fetchFinancingCredits: mockFetchCredits,
  fetchFinancingForwardSales: mockFetchForwardSales,
  fetchFinancingPayments: mockFetchPayments,
  fetchFinancingPayouts: mockFetchPayouts,
  startFinancingBackgroundRefresh: mockStartFinancingBackgroundRefresh,
  stopFinancingBackgroundRefresh: mockStopFinancingBackgroundRefresh,
  financingCreditsByProjectId: {},
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
};

function resetStore(stateOverrides = {}) {
  useStore.setState({
    ...defaultStoreState,
    ...stateOverrides,
  });
}

describe('DeveloperProjectFinancingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a loading skeleton while project details are fetching', () => {
    resetStore({
      loading: { ...defaultStoreState.loading, isFetching: true },
    });

    render(<DeveloperProjectFinancingPage />);

    // Skeletons have aria-hidden="true" or are represented by layout divs
    expect(screen.queryByText('Project Financing')).not.toBeInTheDocument();
  });

  it('renders error block when fetching project details fails', () => {
    resetStore({
      errors: { ...defaultStoreState.errors, fetch: 'API Connection Error' },
    });

    render(<DeveloperProjectFinancingPage />);

    expect(screen.getByText('Unable to load project')).toBeInTheDocument();
    expect(screen.getByText('API Connection Error')).toBeInTheDocument();
    
    const retryBtn = screen.getByRole('button', { name: /try again/i });
    expect(retryBtn).toBeInTheDocument();
    
    fireEvent.click(retryBtn);
    expect(mockFetchProjectById).toHaveBeenCalledWith('project-123');
  });

  it('renders project details, breadcrumbs, dynamic metrics, and handles tab switching', async () => {
    const mockProject = {
      id: 'project-123',
      name: 'Amazon Reforestation Initiative',
      type: 'forestry',
      location: 'Brazil',
      area: 1200,
      start_date: '2023-01-01T00:00:00Z',
      farmers: 45,
      carbon_credits: 5000,
      progress: 40,
      icon: '🌳',
      status: 'active',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    };

    const mockCredits = [
      { id: 'c1', status: 'minted', issued_tons: 100 },
      { id: 'c2', status: 'minting', issued_tons: 50 },
      { id: 'c3', status: 'pending', issued_tons: 200 },
    ];

    const mockSales = [
      { id: 's1', status: 'signed', total_amount: 5000, price_per_ton: 10 },
      { id: 's2', status: 'completed', total_amount: 3000, price_per_ton: 15 },
    ];

    resetStore({
      selectedProject: mockProject,
      financingCreditsByProjectId: { 'project-123': mockCredits },
      financingForwardSalesByProjectId: { 'project-123': mockSales },
    });

    render(<DeveloperProjectFinancingPage />);

    // Verify breadcrumbs and header
    expect(screen.getByText('Developer')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Amazon Reforestation Initiative')).toBeInTheDocument();
    expect(screen.getByText('Project Financing')).toBeInTheDocument();

    // Verify dynamic metrics calculations
    // Credits Minted: 100 + 50 = 150
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('Credits Minted (tCO₂)')).toBeInTheDocument();

    // Forward Sale Revenue: 5000 + 3000 = 8000
    expect(screen.getByText('$8,000.00')).toBeInTheDocument();
    expect(screen.getByText('Forward Sale Revenue')).toBeInTheDocument();

    // Avg Price / Ton: (10 + 15) / 2 = 12.5
    expect(screen.getByText('$12.50')).toBeInTheDocument();
    expect(screen.getByText('Avg Price / Ton')).toBeInTheDocument();

    // Pending Minting: 200
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('Pending Minting (tCO₂)')).toBeInTheDocument();

    // Verify initial default tab (Overview)
    expect(screen.getByTestId('mock-tokenization-status')).toBeInTheDocument();
    expect(screen.getAllByTestId('mock-forward-sale')).toHaveLength(1);

    // Switch to Tokenization Wizard tab
    const wizardTab = screen.getByRole('button', { name: /tokenization wizard/i });
    fireEvent.click(wizardTab);
    expect(screen.getByTestId('mock-tokenization-wizard')).toBeInTheDocument();

    // Switch to Forward Sales tab
    const salesTab = screen.getByRole('button', { name: /^forward sales$/i });
    fireEvent.click(salesTab);
    expect(screen.getByTestId('mock-forward-sale')).toBeInTheDocument();

    // Switch to Payments & Payouts tab
    const paymentsTab = screen.getByRole('button', { name: /payments & payouts/i });
    fireEvent.click(paymentsTab);
    expect(screen.getByTestId('mock-payment-management')).toBeInTheDocument();
  });

  it('triggers store fetches and starts background polling on mount, and stops on unmount', () => {
    const mockProject = {
      id: 'project-123',
      name: 'Amazon Reforestation Initiative',
      status: 'active',
    };

    resetStore({
      selectedProject: mockProject,
    });

    const { unmount } = render(<DeveloperProjectFinancingPage />);

    expect(mockFetchProjectById).toHaveBeenCalledWith('project-123');
    expect(mockFetchCredits).toHaveBeenCalledWith('project-123');
    expect(mockFetchForwardSales).toHaveBeenCalledWith('project-123');
    expect(mockFetchPayments).toHaveBeenCalledWith('project-123');
    expect(mockFetchPayouts).toHaveBeenCalledWith('project-123');
    expect(mockStartFinancingBackgroundRefresh).toHaveBeenCalledWith('project-123');

    unmount();

    expect(mockStopFinancingBackgroundRefresh).toHaveBeenCalledWith('project-123');
  });
});
