import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '@/lib/api/apiClient';
import { fetchMembersApi } from './collaboration.api';

vi.mock('@/lib/api/apiClient', () => ({
  default: { get: vi.fn() },
}));

describe('fetchMembersApi (#801)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('unwraps the backend pagination envelope ({ data, pagination }) into a plain member array', async () => {
    const members = [
      { id: '1', project_id: 'p1', user_id: 'user-1', role: 'owner', permissions: [], joined_at: '', updated_at: '', display_name: 'Ada Lovelace', email: 'ada@example.com' },
    ];
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { data: members, pagination: { total: 1, limit: 20, offset: 0 } },
    });

    const result = await fetchMembersApi('p1');

    expect(apiClient.get).toHaveBeenCalledWith('/collaboration/projects/p1/members');
    expect(result).toEqual(members);
  });

  it('returns an empty array if the envelope has no data array', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { pagination: { total: 0 } } });

    const result = await fetchMembersApi('p1');

    expect(result).toEqual([]);
  });

  it('returns an empty array for a malformed response rather than throwing', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: null });

    const result = await fetchMembersApi('p1');

    expect(result).toEqual([]);
  });
});
