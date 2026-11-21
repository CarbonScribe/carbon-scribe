import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ForwardSale from './ForwardSale';
import type { ForwardSaleAgreement } from '@/lib/api/financing.api';
import type { ProjectMember } from '@/lib/store/collaboration/collaboration.types';

const fetchMembersMock = vi.fn().mockResolvedValue(undefined);
const fetchForwardSalesMock = vi.fn().mockResolvedValue(undefined);
const createForwardSaleOptimisticMock = vi.fn();

type FakeState = {
  financingForwardSalesByProjectId: Record<string, ForwardSaleAgreement[]>;
  financingLoading: { isCreatingForwardSale: boolean };
  financingErrors: { createForwardSale: string | null };
  createForwardSaleOptimistic: typeof createForwardSaleOptimisticMock;
  fetchFinancingForwardSales: typeof fetchForwardSalesMock;
  members: ProjectMember[];
  collaborationLoading: { members: boolean };
  collaborationErrors: { members: string | null };
  fetchMembers: typeof fetchMembersMock;
};

let storeState: FakeState;

function makeState(overrides: Partial<FakeState> = {}): FakeState {
  return {
    financingForwardSalesByProjectId: {},
    financingLoading: { isCreatingForwardSale: false },
    financingErrors: { createForwardSale: null },
    createForwardSaleOptimistic: createForwardSaleOptimisticMock,
    fetchFinancingForwardSales: fetchForwardSalesMock,
    members: [],
    collaborationLoading: { members: false },
    collaborationErrors: { members: null },
    fetchMembers: fetchMembersMock,
    ...overrides,
  };
}

vi.mock('@/lib/store/store', () => ({
  useStore: (selector: (s: FakeState) => unknown) => selector(storeState),
}));

vi.mock('@/lib/api/financing.api', () => ({
  getPriceQuote: vi.fn(),
}));

// Only the buyer field has htmlFor/id label wiring today (added by #801);
// the other inputs are label/input siblings with no `for`, so they aren't
// reachable via getByLabelText.
function fieldByName(container: HTMLElement, name: string): HTMLInputElement {
  const el = container.querySelector(`[name="${name}"]`);
  if (!el) throw new Error(`No field named "${name}"`);
  return el as HTMLInputElement;
}

const members: ProjectMember[] = [
  {
    id: 'm1',
    project_id: 'p1',
    user_id: 'user-1',
    role: 'manager',
    permissions: [],
    joined_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    display_name: 'Ada Lovelace',
    email: 'ada@example.com',
  },
  {
    id: 'm2',
    project_id: 'p1',
    user_id: 'user-2',
    role: 'viewer',
    permissions: [],
    joined_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    email: 'bob@example.com',
  },
];

describe('ForwardSale buyer dropdown (#801)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMembersMock.mockResolvedValue(undefined);
    fetchForwardSalesMock.mockResolvedValue(undefined);
    storeState = makeState();
  });

  it('fetches project members on mount', () => {
    render(<ForwardSale projectId="p1" />);
    expect(fetchMembersMock).toHaveBeenCalledWith('p1');
  });

  it('renders each member as an option, labeled by display name or email', () => {
    storeState = makeState({ members });
    render(<ForwardSale projectId="p1" />);

    const select = screen.getByLabelText('Buyer') as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map((o) => o.textContent);
    expect(optionLabels).toContain('Ada Lovelace');
    expect(optionLabels).toContain('bob@example.com');
  });

  it('shows a loading state while members are being fetched', () => {
    storeState = makeState({ collaborationLoading: { members: true } });
    render(<ForwardSale projectId="p1" />);

    expect(screen.getByText(/loading team members/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Buyer')).not.toBeInTheDocument();
  });

  it('shows an error state with a retry control that re-fetches members', () => {
    storeState = makeState({ collaborationErrors: { members: 'Network error' } });
    render(<ForwardSale projectId="p1" />);

    expect(screen.getByText(/couldn't load team members/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry loading team members/i }));
    expect(fetchMembersMock).toHaveBeenCalledWith('p1');
  });

  it('shows an empty-state message when the project has no members', () => {
    storeState = makeState({ members: [] });
    render(<ForwardSale projectId="p1" />);

    expect(screen.getByText(/no team members — invite a buyer first/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Buyer')).not.toBeInTheDocument();
  });

  it('submits the selected member user_id as buyer_id', async () => {
    storeState = makeState({ members });
    createForwardSaleOptimisticMock.mockResolvedValue({
      id: 'sale-1',
      project_id: 'p1',
      buyer_id: 'user-2',
      vintage_year: 2025,
      tons_committed: 10,
      price_per_ton: 5,
      currency: 'USD',
      total_amount: 50,
      delivery_date: '2025-06-01',
      deposit_percent: 10,
      deposit_paid: false,
      deposit_transaction_id: '',
      payment_schedule: {},
      contract_hash: '',
      status: 'pending',
      created_at: '',
      updated_at: '',
    } as ForwardSaleAgreement);

    const { container } = render(<ForwardSale projectId="p1" />);

    fireEvent.change(screen.getByLabelText('Buyer'), { target: { value: 'user-2' } });
    fireEvent.change(fieldByName(container, 'vintage_year'), { target: { value: '2025' } });
    fireEvent.change(fieldByName(container, 'tons_committed'), { target: { value: '10' } });
    fireEvent.change(fieldByName(container, 'price_per_ton'), { target: { value: '5' } });
    fireEvent.change(fieldByName(container, 'delivery_date'), { target: { value: '2025-06-01' } });

    fireEvent.click(screen.getByRole('button', { name: /create forward sale/i }));

    await waitFor(() => {
      expect(createForwardSaleOptimisticMock).toHaveBeenCalledWith(
        expect.objectContaining({ buyer_id: 'user-2' }),
      );
    });
  });

  it('resets the buyer field to unselected after a successful submit', async () => {
    storeState = makeState({ members });
    createForwardSaleOptimisticMock.mockResolvedValue({
      id: 'sale-1',
      project_id: 'p1',
      buyer_id: 'user-1',
      vintage_year: 2025,
      tons_committed: 10,
      price_per_ton: 5,
      currency: 'USD',
      total_amount: 50,
      delivery_date: '2025-06-01',
      deposit_percent: 10,
      deposit_paid: false,
      deposit_transaction_id: '',
      payment_schedule: {},
      contract_hash: '',
      status: 'pending',
      created_at: '',
      updated_at: '',
    } as ForwardSaleAgreement);

    const { container } = render(<ForwardSale projectId="p1" />);

    const select = screen.getByLabelText('Buyer') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'user-1' } });
    fireEvent.change(fieldByName(container, 'tons_committed'), { target: { value: '10' } });
    fireEvent.change(fieldByName(container, 'price_per_ton'), { target: { value: '5' } });
    fireEvent.change(fieldByName(container, 'delivery_date'), { target: { value: '2025-06-01' } });
    fireEvent.click(screen.getByRole('button', { name: /create forward sale/i }));

    await waitFor(() => expect(createForwardSaleOptimisticMock).toHaveBeenCalled());
    await waitFor(() => expect(select.value).toBe(''));
  });

  it('blocks submit and shows an inline error when no valid buyer is selected', async () => {
    // No members loaded, so the dropdown is replaced by the empty state and
    // buyer_id can never be set to a real member — submitting must still be
    // rejected client-side rather than reaching the API.
    storeState = makeState({ members: [] });
    const { container } = render(<ForwardSale projectId="p1" />);

    fireEvent.change(fieldByName(container, 'vintage_year'), { target: { value: '2025' } });
    fireEvent.change(fieldByName(container, 'tons_committed'), { target: { value: '10' } });
    fireEvent.change(fieldByName(container, 'price_per_ton'), { target: { value: '5' } });
    fireEvent.change(fieldByName(container, 'delivery_date'), { target: { value: '2025-06-01' } });

    const form = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);

    expect(await screen.findByRole('alert')).toHaveTextContent(/select a buyer/i);
    expect(createForwardSaleOptimisticMock).not.toHaveBeenCalled();
  });
});
