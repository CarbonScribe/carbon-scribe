import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import RouteGuard from '@/components/auth/RouteGuard';
import { useAuth } from '@/contexts/AuthContext';
import { useConnectivity } from '@/contexts/ConnectivityContext';
import { usePathname, useRouter } from 'next/navigation';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/contexts/ConnectivityContext', () => ({
  useConnectivity: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);
const mockUsePathname = vi.mocked(usePathname);
const mockUseRouter = vi.mocked(useRouter);
const mockUseConnectivity = vi.mocked(useConnectivity);

function renderGuard() {
  return render(
    <RouteGuard>
      <div>Protected Content</div>
    </RouteGuard>,
  );
}

describe('RouteGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRouter.mockReturnValue({ push: vi.fn() } as any);
    mockUseConnectivity.mockReturnValue({
      state: { isOnline: true },
    } as any);
  });

  it('renders loading state while auth initializes', () => {
    mockUsePathname.mockReturnValue('/team');
    mockUseAuth.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      canAccessRoute: vi.fn(),
    } as any);

    renderGuard();

    expect(screen.getByText('Loading session...')).toBeInTheDocument();
  });

  it('allows public routes without auth', () => {
    mockUsePathname.mockReturnValue('/login');
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      canAccessRoute: vi.fn(),
    } as any);

    renderGuard();

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders access denied for unauthorized role route', () => {
    mockUsePathname.mockReturnValue('/audit');
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      canAccessRoute: vi.fn(() => ({
        allowed: false,
        reason: 'Only admins and auditors can view audit logs.',
      })),
    } as any);

    renderGuard();

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(
      screen.getByText('Only admins and auditors can view audit logs.'),
    ).toBeInTheDocument();
  });

  it('renders children when route is allowed', () => {
    mockUsePathname.mockReturnValue('/marketplace');
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      canAccessRoute: vi.fn(() => ({ allowed: true })),
    } as any);

    renderGuard();

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
