import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReportingPage from '@/app/reporting/page';
import {
  clearAllUnsavedChanges,
  hasUnsavedChanges,
} from '@/lib/forms/unsavedChangesRegistry';

vi.mock('@/contexts/CorporateContext', () => ({
  useCorporate: () => ({ portfolioSummary: {}, retirements: [] }),
}));

vi.mock('@/hooks/useCSRD', () => ({
  useCSRD: () => ({}),
}));

vi.mock('recharts', async () => {
  const Chart = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    BarChart: Chart,
    Bar: Chart,
    XAxis: Chart,
    YAxis: Chart,
    CartesianGrid: Chart,
    Tooltip: Chart,
    ResponsiveContainer: Chart,
    LineChart: Chart,
    Line: Chart,
    Area: Chart,
    ComposedChart: Chart,
  };
});

describe('ReportingPage report-generation guard', () => {
  afterEach(() => {
    clearAllUnsavedChanges();
  });

  it('registers report edits and clears the guard after Generate or Reset', () => {
    render(<ReportingPage />);

    const reportType = screen.getByRole('combobox');
    fireEvent.change(reportType, { target: { value: 'Executive Summary' } });
    expect(hasUnsavedChanges()).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Generate Report' }));
    expect(hasUnsavedChanges()).toBe(false);

    fireEvent.change(reportType, { target: { value: 'Investor Briefing' } });
    expect(hasUnsavedChanges()).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(hasUnsavedChanges()).toBe(false);
  });
});
