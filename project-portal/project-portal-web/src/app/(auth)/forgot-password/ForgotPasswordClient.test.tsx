import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ForgotPasswordClient from './ForgotPasswordClient';
import { requestPasswordResetApi } from '@/lib/api/auth.api';

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

vi.mock('@/components/AuthNavigation', () => ({
  default: () => null,
}));

vi.mock('@/lib/api/auth.api', () => ({
  requestPasswordResetApi: vi.fn(),
}));

describe('ForgotPasswordClient (#800)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an empty or malformed email client-side without calling the API', () => {
    const { container } = render(<ForgotPasswordClient />);
    const form = container.querySelector('form') as HTMLFormElement;

    // fireEvent.submit bypasses the browser's own type="email"/required
    // constraint validation, so this exercises this component's own
    // validate() logic rather than jsdom's native form validation.
    fireEvent.submit(form);
    expect(screen.getAllByText(/email is required/i).length).toBeGreaterThan(0);
    expect(requestPasswordResetApi).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'not-an-email' } });
    fireEvent.submit(form);
    expect(screen.getAllByText(/invalid email address/i).length).toBeGreaterThan(0);
    expect(requestPasswordResetApi).not.toHaveBeenCalled();
  });

  it('submits to the backend and shows the neutral message on success', async () => {
    vi.mocked(requestPasswordResetApi).mockResolvedValue({ message: 'ok' });

    render(<ForgotPasswordClient />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(/if the email exists, a reset link has been sent/i)).toBeInTheDocument();
    expect(requestPasswordResetApi).toHaveBeenCalledWith('user@example.com');
  });

  it('shows the exact same neutral message even when the request fails (#800 — no account enumeration)', async () => {
    vi.mocked(requestPasswordResetApi).mockRejectedValue(new Error('network error'));

    render(<ForgotPasswordClient />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(/if the email exists, a reset link has been sent/i)).toBeInTheDocument();
  });

  it('disables the submit button while the request is in flight', async () => {
    let resolveRequest!: (value: { message: string }) => void;
    vi.mocked(requestPasswordResetApi).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    render(<ForgotPasswordClient />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
    });

    resolveRequest({ message: 'ok' });
    await screen.findByText(/if the email exists, a reset link has been sent/i);
  });

  it('links back to login', () => {
    render(<ForgotPasswordClient />);
    fireEvent.click(screen.getByRole('button', { name: /back to login/i }));
    expect(pushMock).toHaveBeenCalledWith('/login');
  });
});
