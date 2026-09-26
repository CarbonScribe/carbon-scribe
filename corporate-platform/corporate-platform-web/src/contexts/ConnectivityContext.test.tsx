import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ConnectivityProvider, useConnectivity, ConnectionStatus } from './ConnectivityContext';

describe('ConnectivityContext', () => {
  beforeEach(() => {
    // Mock navigator
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with online status when navigator is online', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConnectivityProvider>{children}</ConnectivityProvider>
    );

    const { result } = renderHook(() => useConnectivity(), { wrapper });

    expect(result.current.state.status).toBe('online');
    expect(result.current.state.isOnline).toBe(true);
  });

  it('should initialize with offline status when navigator is offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConnectivityProvider>{children}</ConnectivityProvider>
    );

    const { result } = renderHook(() => useConnectivity(), { wrapper });

    expect(result.current.state.status).toBe('offline');
    expect(result.current.state.isOnline).toBe(false);
  });

  it('should update status when updateStatus is called', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConnectivityProvider>{children}</ConnectivityProvider>
    );

    const { result } = renderHook(() => useConnectivity(), { wrapper });

    act(() => {
      result.current.updateStatus('degraded');
    });

    expect(result.current.state.status).toBe('degraded');
  });

  it('should track consecutive failures and trigger degraded state', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConnectivityProvider>{children}</ConnectivityProvider>
    );

    const { result } = renderHook(() => useConnectivity(), { wrapper });

    // Record 3 consecutive failures
    act(() => {
      result.current.recordApiCall(false);
      result.current.recordApiCall(false);
      result.current.recordApiCall(false);
    });

    expect(result.current.state.status).toBe('degraded');
    expect(result.current.state.consecutiveFailures).toBe(3);
  });

  it('should recover from degraded state after consecutive successes', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConnectivityProvider>{children}</ConnectivityProvider>
    );

    const { result } = renderHook(() => useConnectivity(), { wrapper });

    // Trigger degraded state
    act(() => {
      result.current.recordApiCall(false);
      result.current.recordApiCall(false);
      result.current.recordApiCall(false);
    });

    expect(result.current.state.status).toBe('degraded');

    // Record 2 consecutive successes
    act(() => {
      result.current.recordApiCall(true);
      result.current.recordApiCall(true);
    });

    expect(result.current.state.status).toBe('online');
    expect(result.current.state.consecutiveFailures).toBe(0);
  });

  it('should increment and decrement pending operations', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConnectivityProvider>{children}</ConnectivityProvider>
    );

    const { result } = renderHook(() => useConnectivity(), { wrapper });

    act(() => {
      result.current.incrementPendingOperations();
      result.current.incrementPendingOperations();
    });

    expect(result.current.state.pendingOperations).toBe(2);

    act(() => {
      result.current.decrementPendingOperations();
    });

    expect(result.current.state.pendingOperations).toBe(1);
  });

  it('should not decrement pending operations below zero', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConnectivityProvider>{children}</ConnectivityProvider>
    );

    const { result } = renderHook(() => useConnectivity(), { wrapper });

    act(() => {
      result.current.decrementPendingOperations();
    });

    expect(result.current.state.pendingOperations).toBe(0);
  });

  it('should update lastSuccessfulApiCall on successful API call', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConnectivityProvider>{children}</ConnectivityProvider>
    );

    const { result } = renderHook(() => useConnectivity(), { wrapper });

    // Store the initial value
    const beforeTime = result.current.state.lastSuccessfulApiCall ?? 0;

    act(() => {
      // Mock Date.now to return a different value for the API call
      const originalNow = Date.now;
      vi.useFakeTimers();
      vi.setSystemTime(beforeTime + 1000);
      
      result.current.recordApiCall(true);
      
      vi.useRealTimers();
    });

    // The value should have increased
    const afterTime = result.current.state.lastSuccessfulApiCall ?? 0;
    expect(afterTime).toBeGreaterThan(beforeTime);
  });

  it('should not update lastSuccessfulApiCall on failed API call', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConnectivityProvider>{children}</ConnectivityProvider>
    );

    const { result } = renderHook(() => useConnectivity(), { wrapper });

    // Ensure beforeTime is a number, default to 0 if null
    const beforeTime = result.current.state.lastSuccessfulApiCall ?? 0;

    act(() => {
      result.current.recordApiCall(false);
    });

    expect(result.current.state.lastSuccessfulApiCall).toBe(beforeTime);
  });

  it('should handle online/offline events', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConnectivityProvider>{children}</ConnectivityProvider>
    );

    const { result } = renderHook(() => useConnectivity(), { wrapper });

    // Simulate offline event
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.state.status).toBe('offline');
    expect(result.current.state.isOnline).toBe(false);

    // Simulate online event
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current.state.status).toBe('online');
    expect(result.current.state.isOnline).toBe(true);
  });

  it('should retry pending operations and update status', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConnectivityProvider>{children}</ConnectivityProvider>
    );

    const { result } = renderHook(() => useConnectivity(), { wrapper });

    act(() => {
      result.current.updateStatus('offline');
      result.current.incrementPendingOperations();
      result.current.incrementPendingOperations();
    });

    expect(result.current.state.status).toBe('offline');
    expect(result.current.state.pendingOperations).toBe(2);

    // Mock request queue
    vi.mock('@/lib/utils/requestQueue', () => ({
      requestQueue: {
        processQueue: vi.fn().mockResolvedValue({ success: 2, failed: 0 }),
      },
    }));

    await act(async () => {
      await result.current.retryPendingOperations();
    });

    expect(result.current.state.status).toBe('online');
    expect(result.current.state.pendingOperations).toBe(0);
  });
});
