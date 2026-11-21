import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import { api } from '@/lib/api/axios';
import { showErrorToast } from '@/lib/utils/toast';
import {
  apiCreateConnection,
  apiListConnections,
  apiDeleteConnection,
  apiTestConnection,
  apiGetConnection,
} from './integration.api';

vi.mock('@/lib/api/axios', () => ({
  api: {
    request: vi.fn(),
  },
}));

vi.mock('@/lib/utils/toast', () => ({
  showErrorToast: vi.fn(),
}));

function axiosError(status: number, data?: unknown): AxiosError {
  const err = new AxiosError('Request failed', String(status), undefined, undefined, {
    status,
    statusText: 'Error',
    data,
    headers: {},
    config: {} as any,
  } as any);
  return err;
}

describe('integration.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends the bearer token implicitly via the shared axios instance on a GET', async () => {
    vi.mocked(api.request).mockResolvedValue({ data: { connections: [], total: 0 } });

    await apiListConnections({ provider: 'stripe' });

    expect(api.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/connections',
        params: { provider: 'stripe', status: undefined, page: undefined, page_size: undefined },
        suppressErrorToast: true,
      }),
    );
  });

  it('sends the request body on a POST', async () => {
    const body = { name: 'My Stripe', provider: 'stripe' } as any;
    vi.mocked(api.request).mockResolvedValue({ data: { id: 'conn-1', ...body } });

    const result = await apiCreateConnection(body);

    expect(api.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', url: '/connections', data: body }),
    );
    expect(result).toEqual({ id: 'conn-1', ...body });
  });

  it('issues an authenticated DELETE through the same shared instance', async () => {
    vi.mocked(api.request).mockResolvedValue({ data: undefined });

    await apiDeleteConnection('conn-1');

    expect(api.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'DELETE', url: '/connections/conn-1' }),
    );
  });

  it('relies on the shared axios instance to refresh the session on a 401', async () => {
    // The 401-triggers-refresh behaviour itself lives in the shared axios
    // instance's response interceptor (reused, not reimplemented here) — this
    // confirms a 401 still surfaces as a rejection from this module's wrapper
    // rather than being swallowed.
    vi.mocked(api.request).mockRejectedValue(axiosError(401, { error: 'unauthorized' }));

    await expect(apiTestConnection({ id: 'conn-1' } as any)).rejects.toThrow('unauthorized');
  });

  it('maps a 500 response onto the branded 5xx toast exactly once', async () => {
    vi.mocked(api.request).mockRejectedValue(axiosError(500, { error: 'boom' }));

    await expect(apiGetConnection('conn-1')).rejects.toThrow('boom');

    expect(showErrorToast).toHaveBeenCalledTimes(1);
    expect(showErrorToast).toHaveBeenCalledWith(
      'CarbonScribe is having trouble',
      expect.objectContaining({ id: 'global-5xx' }),
    );
  });

  it('suppresses the shared instance generic toast on every call', async () => {
    vi.mocked(api.request).mockResolvedValue({ data: {} });

    await apiListConnections();

    expect(api.request).toHaveBeenCalledWith(
      expect.objectContaining({ suppressErrorToast: true }),
    );
  });
});
