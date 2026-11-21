import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResetPasswordClient from './ResetPasswordClient';
import { resetPasswordApi } from '@/lib/api/auth.api';

const pushMock = vi.fn();
const replaceMock = vi.fn();
let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  useSearchParams: () => searchParams,
}));

vi.mock('@/components/AuthNavigation', () => ({
  default: () => null,
}));

vi.mock('@/lib/api/auth.api', () => ({
  resetPasswordApi: vi.fn(),
}));

function fillAndSubmit(container: HTMLElement, newPassword: string, confirmPassword: string) {
  fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: newPassword } });
  fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: confirmPassword } });
  const form = container.querySelector('form') as HTMLFormElement;
  fireEvent.submit(form);
}

describe('ResetPasswordClient (#800)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParams = new URLSearchParams();
  });

  it('shows a clear missing-token state when there is no token in the URL', () => {
    render(<ResetPasswordClient />);
    expect(screen.getByText(/missing reset link/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^new password/i)).not.toBeInTheDocument();
  });

  it('rejects a password shorter than 8 characters client-side', () => {
    searchParams = new URLSearchParams({ token: 'tok-123' });
    const { container } = render(<ResetPasswordClient />);

    fillAndSubmit(container, 'short', 'short');

    expect(screen.getAllByText(/minimum 8 characters/i).length).toBeGreaterThan(0);
    expect(resetPasswordApi).not.toHaveBeenCalled();
  });

  it('rejects mismatched password confirmation client-side', () => {
    searchParams = new URLSearchParams({ token: 'tok-123' });
    const { container } = render(<ResetPasswordClient />);

    fillAndSubmit(container, 'longenough1', 'doesnotmatch1');

    expect(screen.getAllByText(/passwords do not match/i).length).toBeGreaterThan(0);
    expect(resetPasswordApi).not.toHaveBeenCalled();
  });

  it('resets the password via the backend with the token from the URL', async () => {
    searchParams = new URLSearchParams({ token: 'tok-123' });
    vi.mocked(resetPasswordApi).mockResolvedValue({ message: 'ok' });
    const { container } = render(<ResetPasswordClient />);

    fillAndSubmit(container, 'longenough1', 'longenough1');

    await waitFor(() => {
      expect(resetPasswordApi).toHaveBeenCalledWith({ token: 'tok-123', new_password: 'longenough1' });
    });
    expect(await screen.findByText(/password reset/i)).toBeInTheDocument();
  });

  it('links back to login after a successful reset', async () => {
    searchParams = new URLSearchParams({ token: 'tok-123' });
    vi.mocked(resetPasswordApi).mockResolvedValue({ message: 'ok' });
    const { container } = render(<ResetPasswordClient />);

    fillAndSubmit(container, 'longenough1', 'longenough1');

    fireEvent.click(await screen.findByRole('button', { name: /continue to login/i }));
    expect(replaceMock).toHaveBeenCalledWith('/login');
  });

  it('shows a clear error for an invalid or expired token', async () => {
    searchParams = new URLSearchParams({ token: 'bad-token' });
    vi.mocked(resetPasswordApi).mockRejectedValue({
      response: { status: 400, data: { error: 'Invalid or expired reset token' } },
    });
    const { container } = render(<ResetPasswordClient />);

    fillAndSubmit(container, 'longenough1', 'longenough1');

    expect(await screen.findByText(/invalid or expired reset token/i)).toBeInTheDocument();
    expect(screen.getByText(/link invalid or expired/i)).toBeInTheDocument();
  });

  it('disables the submit button while the request is in flight', async () => {
    searchParams = new URLSearchParams({ token: 'tok-123' });
    let resolveRequest!: (value: { message: string }) => void;
    vi.mocked(resetPasswordApi).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const { container } = render(<ResetPasswordClient />);

    fillAndSubmit(container, 'longenough1', 'longenough1');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /resetting/i })).toBeDisabled();
    });

    resolveRequest({ message: 'ok' });
    await screen.findByText(/password reset/i);
  });
});
