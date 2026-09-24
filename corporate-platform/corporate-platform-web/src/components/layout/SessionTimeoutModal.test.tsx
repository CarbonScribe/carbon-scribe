import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SessionTimeoutModal from './SessionTimeoutModal';
import { useAuth } from '@/contexts/AuthContext';
import {
  registerUnsavedChanges,
  clearAllUnsavedChanges,
} from '@/lib/forms/unsavedChangesRegistry';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  mockUseAuth.mockReturnValue({
    sessionExpiryState: 'active',
    secondsUntilExpiry: 0,
    renewSession: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as ReturnType<typeof useAuth>);
}

describe('SessionTimeoutModal', () => {
  beforeAll(() => {
    // jsdom never computes layout, so `offsetParent` is always null —
    // useFocusTrap's visibility check (`el.offsetParent !== null`) would
    // otherwise treat every element as invisible and never autofocus.
    // This is the standard shim for exercising focus-trap/visibility logic
    // under jsdom; scoped to this file only.
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      get() {
        return this.parentElement;
      },
      configurable: true,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearAllUnsavedChanges();
  });

  it('renders nothing when the session is active', () => {
    mockAuth({ sessionExpiryState: 'active' });
    render(<SessionTimeoutModal />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('renders nothing during the warning state when there are no unsaved changes', () => {
    mockAuth({ sessionExpiryState: 'warning', secondsUntilExpiry: 120 });
    render(<SessionTimeoutModal />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('renders the blocking modal during the warning state once a form has unsaved changes', async () => {
    registerUnsavedChanges('test-form');
    mockAuth({ sessionExpiryState: 'warning', secondsUntilExpiry: 120 });
    render(<SessionTimeoutModal />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();

    // Let useFocusTrap's async autofocus settle within this test's own
    // act()-wrapped async boundary, rather than firing during teardown.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /renew session/i })).toHaveFocus(),
    );
  });

  it('renders the blocking modal during the grace state and traps focus on the renew button', async () => {
    mockAuth({ sessionExpiryState: 'grace', secondsUntilExpiry: 25 });
    render(<SessionTimeoutModal />);

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/session expired/i)).toBeInTheDocument();

    const renewButton = screen.getByRole('button', { name: /renew session/i });
    await waitFor(() => expect(renewButton).toHaveFocus());
  });

  it('calls renewSession when the renew button is clicked', async () => {
    const renewSession = vi.fn().mockResolvedValue(true);
    mockAuth({ sessionExpiryState: 'grace', secondsUntilExpiry: 25, renewSession });
    const user = userEvent.setup();
    render(<SessionTimeoutModal />);

    await user.click(screen.getByRole('button', { name: /renew session/i }));

    expect(renewSession).toHaveBeenCalledTimes(1);
  });

  it('calls renewSession when Enter is pressed on the focused renew button', async () => {
    const renewSession = vi.fn().mockResolvedValue(true);
    mockAuth({ sessionExpiryState: 'grace', secondsUntilExpiry: 25, renewSession });
    const user = userEvent.setup();
    render(<SessionTimeoutModal />);

    const renewButton = await screen.findByRole('button', { name: /renew session/i });
    await waitFor(() => expect(renewButton).toHaveFocus());
    await user.keyboard('{Enter}');

    expect(renewSession).toHaveBeenCalledTimes(1);
  });

  it('calls renewSession (not a dismiss action) when Escape is pressed', async () => {
    const renewSession = vi.fn().mockResolvedValue(true);
    mockAuth({ sessionExpiryState: 'grace', secondsUntilExpiry: 25, renewSession });
    const user = userEvent.setup();
    render(<SessionTimeoutModal />);

    await user.keyboard('{Escape}');

    expect(renewSession).toHaveBeenCalledTimes(1);
    // Still open — Escape renews, it never dismisses this modal.
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('escalates a failed renewal to an explicit imminent-logout message with a login link', async () => {
    const renewSession = vi.fn().mockResolvedValue(false);
    mockAuth({ sessionExpiryState: 'grace', secondsUntilExpiry: 12, renewSession });
    const user = userEvent.setup();
    render(<SessionTimeoutModal />);

    await user.click(screen.getByRole('button', { name: /renew session/i }));

    expect(await screen.findByText(/renewal failed/i)).toBeInTheDocument();
    expect(screen.getByText(/logged out in/i)).toBeInTheDocument();
    const loginLink = screen.getByRole('link', { name: /go to login now/i });
    expect(loginLink).toHaveAttribute('href', '/login');
  });
});
