import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UnsavedChangesNavigationGuard from './UnsavedChangesNavigationGuard';
import {
  clearAllUnsavedChanges,
  registerUnsavedChanges,
} from '@/lib/forms/unsavedChangesRegistry';
import { useGuardedRouter } from '@/hooks/useGuardedRouter';

const { router } = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

function GuardedRouterButtons() {
  const guardedRouter = useGuardedRouter();

  return (
    <button type="button" onClick={() => guardedRouter.push('/destination')}>
      Push route
    </button>
  );
}

describe('UnsavedChangesNavigationGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerUnsavedChanges('dirty-form');
  });

  afterEach(() => {
    clearAllUnsavedChanges();
  });

  it('prompts before internal navigation and allows cancelling or confirming', () => {
    render(
      <>
        <UnsavedChangesNavigationGuard />
        <a href="/settings">Settings</a>
      </>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Settings' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Leave without saving?',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Stay on page' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('link', { name: 'Settings' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Leave without saving' }),
    );
    expect(router.push).toHaveBeenCalledWith('/settings');
  });

  it('holds a dirty programmatic push until confirmed and allows cancellation', () => {
    render(
      <>
        <UnsavedChangesNavigationGuard />
        <GuardedRouterButtons />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Push route' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Stay on page' }));
    expect(router.push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Push route' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Leave without saving' }),
    );
    expect(router.push).toHaveBeenCalledWith('/destination');
  });

  it('pushes immediately when there are no dirty forms', () => {
    act(() => clearAllUnsavedChanges());
    render(
      <>
        <UnsavedChangesNavigationGuard />
        <GuardedRouterButtons />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Push route' }));
    expect(router.push).toHaveBeenCalledWith('/destination');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
