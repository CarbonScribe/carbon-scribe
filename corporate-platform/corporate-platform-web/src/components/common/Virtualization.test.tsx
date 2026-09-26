import React, { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useVirtualizer } from '@tanstack/react-virtual';

interface Item {
  id: string;
  name: string;
}

function VirtualizedTable({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 2,
    initialRect: { width: 800, height: 200 },
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0)
      : 0;

  return (
    <div ref={parentRef} style={{ height: '200px', overflow: 'auto' }}>
      <table>
        <tbody>
          {paddingTop > 0 && (
            <tr data-testid="top-spacer">
              <td style={{ height: `${paddingTop}px` }} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const item = items[virtualRow.index];
            return (
              <tr key={item.id} data-testid="virtual-row">
                <td>{item.name}</td>
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr data-testid="bottom-spacer">
              <td style={{ height: `${paddingBottom}px` }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

describe('Row Virtualization Verification', () => {
  it('renders a reduced subset of DOM nodes when total rows is large', () => {
    const totalItemsCount = 200;
    const items: Item[] = Array.from({ length: totalItemsCount }, (_, i) => ({
      id: `item-${i + 1}`,
      name: `Row Item ${i + 1}`,
    }));

    const { container } = render(<VirtualizedTable items={items} />);

    // In a 200px viewport with 50px item height and overscan 2,
    // virtualizer renders ~4-8 items instead of all 200 items.
    const renderedVirtualRows = screen.queryAllByTestId('virtual-row');
    const totalRenderedTr = container.querySelectorAll('tbody tr');

    expect(renderedVirtualRows.length).toBeLessThan(totalItemsCount);
    expect(renderedVirtualRows.length).toBeLessThanOrEqual(20);
    expect(totalRenderedTr.length).toBeLessThan(totalItemsCount);
  });
});
