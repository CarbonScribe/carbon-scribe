import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Pagination } from '@/components/common/Pagination';

describe('Pagination Component', () => {
  it('renders page information and total item count', () => {
    render(
      <Pagination
        page={2}
        totalPages={5}
        total={50}
        pageSize={10}
        itemLabel="documents"
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Showing 11 to 20 of 50 documents');
    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument();
  });

  it('handles navigation button clicks', () => {
    const handlePageChange = vi.fn();
    render(
      <Pagination
        page={2}
        totalPages={5}
        total={50}
        pageSize={10}
        onPageChange={handlePageChange}
      />
    );

    const prevButton = screen.getByRole('button', { name: /previous page/i });
    const nextButton = screen.getByRole('button', { name: /next page/i });

    fireEvent.click(prevButton);
    expect(handlePageChange).toHaveBeenCalledWith(1);

    fireEvent.click(nextButton);
    expect(handlePageChange).toHaveBeenCalledWith(3);
  });

  it('disables previous button on first page and next button on last page', () => {
    const { rerender } = render(
      <Pagination
        page={1}
        totalPages={3}
        total={30}
        pageSize={10}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next page/i })).not.toBeDisabled();

    rerender(
      <Pagination
        page={3}
        totalPages={3}
        total={30}
        pageSize={10}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /previous page/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });

  it('renders page size selector and calls onPageSizeChange', () => {
    const handlePageSizeChange = vi.fn();
    render(
      <Pagination
        page={1}
        totalPages={5}
        total={50}
        pageSize={10}
        showPageSizeSelector
        onPageChange={vi.fn()}
        onPageSizeChange={handlePageSizeChange}
        itemLabel="records"
      />
    );

    const select = screen.getByLabelText(/select rows per page for records/i);
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('10');

    fireEvent.change(select, { target: { value: '20' } });
    expect(handlePageSizeChange).toHaveBeenCalledWith(20);
  });

  it('handles 0 total items gracefully', () => {
    render(
      <Pagination
        page={1}
        totalPages={1}
        total={0}
        pageSize={10}
        itemLabel="items"
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Showing 0 to 0 of 0 items');
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });
});
