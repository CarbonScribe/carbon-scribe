import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from '@/app/login/page';

let mockResetParam: string | null = null;

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === 'reset' ? mockResetParam : null),
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ login: vi.fn(), isLoading: false }),
}));

describe('LoginPage', () => {
  it('shows no confirmation banner by default', () => {
    mockResetParam = null;
    render(<LoginPage />);

    expect(
      screen.queryByText(/your password has been reset/i),
    ).not.toBeInTheDocument();
  });

  it('shows a confirmation message after a successful password reset redirect', () => {
    mockResetParam = 'success';
    render(<LoginPage />);

    expect(
      screen.getByText(/your password has been reset/i),
    ).toBeInTheDocument();
  });
});
