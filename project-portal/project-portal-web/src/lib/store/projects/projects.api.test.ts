import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '@/lib/api/apiClient';
import { fetchProjectsApi } from './projects.api';

vi.mock('@/lib/api/apiClient', () => ({
  default: { get: vi.fn() },
}));

describe('fetchProjectsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({ data: { projects: [] } });
  });

  it('sends search, type, status, pagination, and abort signal as request params', async () => {
    const controller = new AbortController();

    await fetchProjectsApi(
      10,
      0,
      { search: 'forest', type: 'Reforestation', status: 'active' },
      controller.signal
    );

    expect(apiClient.get).toHaveBeenCalledWith('/projects', {
      params: {
        limit: 10,
        offset: 0,
        search: 'forest',
        type: 'Reforestation',
        status: 'active',
      },
      signal: controller.signal,
    });
  });
});