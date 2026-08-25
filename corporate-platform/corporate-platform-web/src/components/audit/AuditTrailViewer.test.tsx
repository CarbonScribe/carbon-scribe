import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import AuditTrailViewer from '@/components/audit/AuditTrailViewer';
import { queryAuditEvents } from '@/lib/api/audit.api';

vi.mock('@/lib/api/audit.api', () => ({
  queryAuditEvents: vi.fn(),
  exportAuditEvents: vi.fn(),
}));

vi.mock('@/hooks/useAccessibility', () => ({
  useAccessibility: () => ({ labels: { closeCart: 'Close' } }),
}));

vi.mock('@/hooks/useAnnouncement', () => ({
  useAnnouncement: () => ({ announce: vi.fn() }),
}));

vi.mock('@/lib/telemetry/errorReporter', () => ({
  reportError: vi.fn(),
}));

const mockQueryAuditEvents = vi.mocked(queryAuditEvents);

const mockEvents = Array.from({ length: 20 }, (_, i) => ({
  id: `event-${i + 1}`,
  companyId: 'company-1',
  userId: 'user-1',
  eventType: 'RETIREMENT',
  action: 'CREATE',
  entityType: 'RETIREMENT',
  entityId: `retirement-id-${i + 1}`,
  hash: `hash-${i + 1}-1234567890123456`,
  previousHash: `prev-hash-${i + 1}`,
  timestamp: '2026-01-01T12:00:00.000Z',
  createdAt: '2026-01-01T12:00:00.000Z',
}));

describe('AuditTrailViewer Pagination & Virtualization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryAuditEvents.mockResolvedValue({
      events: mockEvents,
      total: 50,
      page: 1,
      limit: 20,
    });
  });

  it('renders events table and shared pagination controls', async () => {
    render(<AuditTrailViewer isOpen={true} />);

    expect(await screen.findByText('Audit Trail')).toBeInTheDocument();
    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Showing 1 to 20 of 50 events');
  });

  it('navigates to next page on pagination click', async () => {
    render(<AuditTrailViewer isOpen={true} />);

    await screen.findByText('Audit Trail');

    const nextBtn = screen.getByRole('button', { name: /next page/i });
    fireEvent.click(nextBtn);

    expect(mockQueryAuditEvents).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 20 })
    );
  });

  it('changes page size using selector', async () => {
    render(<AuditTrailViewer isOpen={true} />);

    await screen.findByText('Audit Trail');

    const pageSizeSelect = screen.getByLabelText(/select rows per page for events/i);
    fireEvent.change(pageSizeSelect, { target: { value: '50' } });

    expect(mockQueryAuditEvents).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 50 })
    );
  });
});
