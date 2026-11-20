import { describe, it, expect, vi, beforeEach } from 'vitest';
import { portfolioService, exportPortfolioTransactionsCsv } from '@/services/portfolio.service';
import { apiClient } from '@/services/api-client';

vi.mock('@/services/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

async function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe('portfolioService.exportTransactionsCsv', () => {
  it('throws an error if transactions array is empty', async () => {
    await expect(portfolioService.exportTransactionsCsv([])).rejects.toThrow(
      'No transactions available to export'
    );
  });

  it('throws an error if transactions parameter is null or undefined', async () => {
    await expect(portfolioService.exportTransactionsCsv(null as any)).rejects.toThrow(
      'No transactions available to export'
    );
  });

  it('serializes transactions with correct headers and values', async () => {
    const transactions = [
      {
        id: 'tx-1',
        date: '2026-05-10T12:00:00.000Z',
        type: 'Purchase',
        project: 'Amazon Reforestation',
        amount: 2500,
        price: 18.5,
        status: 'Completed',
      },
      {
        id: 'tx-2',
        date: '2026-06-15T00:00:00.000Z',
        type: 'Retirement',
        project: 'Solar Farm Alpha',
        amount: 500,
        price: 22.0,
        status: 'Completed',
      },
    ];

    const blob = await portfolioService.exportTransactionsCsv(transactions);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/csv;charset=utf-8;');

    const text = await readBlob(blob);
    const lines = text.split('\n');

    expect(lines[0]).toBe('ID,Date,Type,Project,Amount,Price,Status');
    expect(lines[1]).toBe('tx-1,2026-05-10,Purchase,Amazon Reforestation,2500,18.5,Completed');
    expect(lines[2]).toBe('tx-2,2026-06-15,Retirement,Solar Farm Alpha,500,22,Completed');
  });

  it('escapes cells containing commas, quotes, and newlines (RFC 4180)', async () => {
    const transactions = [
      {
        id: 'tx-special',
        date: '2026-07-01T00:00:00.000Z',
        type: 'Purchase',
        project: 'Project, "Highland" with \n newline',
        amount: 100,
        price: 12.5,
        status: 'Completed',
      },
    ];

    const blob = await portfolioService.exportTransactionsCsv(transactions);
    const text = await readBlob(blob);

    expect(text).toContain('"Project, ""Highland"" with \n newline"');
  });

  it('handles missing or fallback values gracefully', async () => {
    const transactions = [
      {
        id: '',
        date: '',
        type: undefined,
        project: undefined,
        amount: undefined,
        price: undefined,
        status: undefined,
      },
    ];

    const blob = await portfolioService.exportTransactionsCsv(transactions);
    const text = await readBlob(blob);
    const lines = text.split('\n');

    expect(lines[0]).toBe('ID,Date,Type,Project,Amount,Price,Status');
    expect(lines[1]).toBe(',N/A,N/A,N/A,0,0,Completed');
  });

  it('works via the exportCsv alias and standalone export function', async () => {
    const transactions = [
      {
        id: 'tx-alias',
        date: '2026-08-01',
        type: 'Purchase',
        project: 'Wind Farm',
        amount: 50,
        price: 10,
        status: 'Completed',
      },
    ];

    const blob1 = await portfolioService.exportCsv(transactions);
    const blob2 = await exportPortfolioTransactionsCsv(transactions);

    expect(await readBlob(blob1)).toBe(await readBlob(blob2));
  });
});
