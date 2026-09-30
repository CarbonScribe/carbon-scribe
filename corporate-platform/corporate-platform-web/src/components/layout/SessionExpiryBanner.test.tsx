import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SessionExpiryBanner from './SessionExpiryBanner';
import SessionTimeoutModal from './SessionTimeoutModal';
import { useAuth } from '@/contexts/AuthContext';
import { clearAllUnsavedChanges } from '@/lib/forms/unsavedChangesRegistry';

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

describe('SessionExpiryBanner', () => {
  beforeAll(() => {
    // jsdom never computes layout, so `offsetParent` is always null —
    // useFocusTrap's visibility check (`el.offsetParent !== null`) would
    // otherwise treat every element as invisible and never autofocus.
    // This is the standard shim for exercising focus-trap/visibility logic
    // under jsdom; scoped to this file only. Needed here because this file
    // renders SessionTimeoutModal (via useFocusTrap) in the regression test
    // below.
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
    render(<SessionExpiryBanner />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders a dismissible banner during the warning state', () => {
    mockAuth({ sessionExpiryState: 'warning', secondsUntilExpiry: 90 });
    render(<SessionExpiryBanner />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss session warning/i })).toBeInTheDocument();
  });

  it('no longer renders the old grace-state banner UI (superseded by SessionTimeoutModal)', () => {
    mockAuth({ sessionExpiryState: 'grace', secondsUntilExpiry: 20 });
    render(<SessionExpiryBanner />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('can be dismissed during the warning state', async () => {
    mockAuth({ sessionExpiryState: 'warning', secondsUntilExpiry: 90 });
    const user = userEvent.setup();
    render(<SessionExpiryBanner />);

    await user.click(screen.getByRole('button', { name: /dismiss session warning/i }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // Regression test for the bug this issue reported: dismissing the
  // warning banner must not suppress the later, non-dismissable grace
  // modal — they are two separate components with independent state.
  it('dismissing the warning banner does not suppress the later grace-state modal', async () => {
    mockAuth({ sessionExpiryState: 'warning', secondsUntilExpiry: 30 });
    const user = userEvent.setup();

    const { rerender } = render(
      <>
        <SessionExpiryBanner />
        <SessionTimeoutModal />
      </>,
    );

    expect(screen.getByRole('button', { name: /dismiss session warning/i })).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /dismiss session warning/i }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Time passes: the token actually expires and AuthContext moves into
    // the grace state.
    mockAuth({ sessionExpiryState: 'grace', secondsUntilExpiry: 30 });
    rerender(
      <>
        <SessionExpiryBanner />
        <SessionTimeoutModal />
      </>,
    );

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/session expired/i)).toBeInTheDocument();

    // Let useFocusTrap's async autofocus (if scheduled in this environment)
    // settle within this test's own act()-wrapped polling, rather than
    // firing during teardown.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /renew session/i })).toHaveFocus(),
    );
  });
});
