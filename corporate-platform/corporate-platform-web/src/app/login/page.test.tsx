import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from '@/app/login/page';

let mockResetParam: string | null = null;
let mockRedirectParam: string | null = null;
const mockLogin = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === 'reset') return mockResetParam;
      if (key === 'redirect') return mockRedirectParam;
      return null;
    },
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, isLoading: false }),
}));

describe('LoginPage', () => {
  it('shows no confirmation banner by default', () => {
    mockResetParam = null;
    mockRedirectParam = null;
    render(<LoginPage />);

    expect(
      screen.queryByText(/your password has been reset/i),
    ).not.toBeInTheDocument();
  });

  it('shows a confirmation message after a successful password reset redirect', () => {
    mockResetParam = 'success';
    mockRedirectParam = null;
    render(<LoginPage />);

    expect(
      screen.getByText(/your password has been reset/i),
    ).toBeInTheDocument();
  });

  it('passes the originally requested internal path to login', async () => {
    mockResetParam = null;
    mockRedirectParam = '/portfolio?tab=credits';
    mockLogin.mockResolvedValue(undefined);
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        { email: 'user@example.com', password: 'password' },
        '/portfolio?tab=credits',
      );
    });
  });
});
