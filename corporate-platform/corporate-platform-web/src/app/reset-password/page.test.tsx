import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResetPasswordPage from '@/app/reset-password/page';
import { resetPasswordApi } from '@/lib/api/auth.api';
import { ApiError } from '@/lib/api/http';

const mockPush = vi.fn();
let mockToken: string | null = 'valid-reset-token';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'token' ? mockToken : null),
  }),
}));

vi.mock('@/lib/api/auth.api', () => ({
  resetPasswordApi: vi.fn(),
}));

function fillAndSubmit(password: string, confirmPassword: string) {
  fireEvent.change(screen.getByLabelText(/^new password$/i), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText(/confirm new password/i), {
    target: { value: confirmPassword },
  });
  fireEvent.click(screen.getByRole('button', { name: /reset password/i }));
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToken = 'valid-reset-token';
  });

  it('renders a working reset form instead of a 404 when a token is present', () => {
    render(<ResetPasswordPage />);

    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
  });

  it('completes the reset and redirects to /login on a valid token and password', async () => {
    (resetPasswordApi as any).mockResolvedValue({ success: true });

    render(<ResetPasswordPage />);
    fillAndSubmit('ValidPass1!', 'ValidPass1!');

    await waitFor(() => {
      expect(resetPasswordApi).toHaveBeenCalledWith(
        'valid-reset-token',
        'ValidPass1!',
      );
    });
    expect(mockPush).toHaveBeenCalledWith('/login?reset=success');
  });

  it('rejects a weak password before calling the API', async () => {
    render(<ResetPasswordPage />);
    fillAndSubmit('weak', 'weak');

    expect(resetPasswordApi).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/password must be at least 8 characters/i),
    ).toBeInTheDocument();
  });

  it('rejects mismatched passwords before calling the API', async () => {
    render(<ResetPasswordPage />);
    fillAndSubmit('ValidPass1!', 'DifferentPass1!');

    expect(resetPasswordApi).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/passwords do not match/i),
    ).toBeInTheDocument();
  });

  it('shows a clear error with a link back to /forgot-password when the token is missing', () => {
    mockToken = null;

    render(<ResetPasswordPage />);

    expect(screen.queryByLabelText(/^new password$/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/invalid or has expired/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /request a new reset link/i }),
    ).toHaveAttribute('href', '/forgot-password');
  });

  it('shows a clear error with a link back to /forgot-password when the token is expired/invalid', async () => {
    (resetPasswordApi as any).mockRejectedValue(
      new ApiError(400, 'This reset token is invalid or has expired.', null),
    );

    render(<ResetPasswordPage />);
    fillAndSubmit('ValidPass1!', 'ValidPass1!');

    expect(
      await screen.findByText(/this reset token is invalid or has expired/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /request a new reset link/i }),
    ).toHaveAttribute('href', '/forgot-password');
    expect(mockPush).not.toHaveBeenCalled();
  });
});
