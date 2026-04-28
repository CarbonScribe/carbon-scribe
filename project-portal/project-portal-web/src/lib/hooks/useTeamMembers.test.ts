import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTeamMembers } from './useTeamMembers';
import { useStore } from '@/lib/store/store';
import type { Project } from '@/lib/store/projects/projects.types';

vi.mock('@/lib/store/store');

const mockUseStore = vi.mocked(useStore);

const mockProject: Project = {
  id: 'proj-1',
  name: 'Carbon Initiative',
  type: 'reforestation',
  location: 'Nairobi, Kenya',
  area: 500,
  farmers: 25,
  carbon_credits: 1200,
  progress: 65,
  icon: '🌱',
  status: 'active',
  start_date: '2024-01-01',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockMembers = [
  { id: 'm1', project_id: 'proj-1', user_id: 'user1', role: 'Owner', permissions: ['all'], joined_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'm2', project_id: 'proj-1', user_id: 'user2', role: 'Contributor', permissions: ['read', 'write'], joined_at: '2024-01-02T00:00:00Z', updated_at: '2024-01-02T00:00:00Z' },
];

const mockInvitations = [
  { id: 'i1', project_id: 'proj-1', email: 'pending@example.com', role: 'Viewer', status: 'pending', expires_at: '2024-12-01T00:00:00Z', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z', resent_count: 0 },
];

describe('useTeamMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupStore = (overrides = {}) => {
    const state = {
      ...{
        projects: [] as Project[],
        loading: { isFetching: false },
        selectedProject: null,
        setSelectedProject: vi.fn(),
        clearSelectedProject: vi.fn(),
        fetchProjects: vi.fn(),
        members: [] as any[],
        invitations: [] as any[],
        collaborationLoading: { members: false, invitations: false },
        collaborationErrors: { members: null, invitations: null },
        fetchMembers: vi.fn(),
        fetchInvitations: vi.fn(),
        removeMember: vi.fn(),
        inviteUser: vi.fn(),
        resetCollaborationState: vi.fn(),
        user: null,
      },
      ...overrides,
    };
    mockUseStore.mockImplementation((selector) => selector(state as any));
  };

  it('should return projects and selectedProject from store', () => {
    setupStore({ projects: [mockProject], selectedProject: mockProject });
    const { result } = renderHook(() => useTeamMembers());
    expect(result.current.projects).toEqual([mockProject]);
    expect(result.current.selectedProject).toEqual(mockProject);
  });

  it('should return members and invitations from store', () => {
    setupStore({ members: mockMembers, invitations: mockInvitations });
    const { result } = renderHook(() => useTeamMembers());
    expect(result.current.members).toEqual(mockMembers);
    expect(result.current.invitations).toEqual(mockInvitations);
  });

  it('should return loading states from store', () => {
    setupStore({ collaborationLoading: { members: true, invitations: false } });
    const { result } = renderHook(() => useTeamMembers());
    expect(result.current.isLoadingMembers).toBe(true);
    expect(result.current.isLoadingInvitations).toBe(false);
  });

  it('should return error states from store', () => {
    setupStore({ collaborationErrors: { members: 'Fetch error', invitations: null } });
    const { result } = renderHook(() => useTeamMembers());
    expect(result.current.errorMembers).toBe('Fetch error');
    expect(result.current.errorInvitations).toBeNull();
  });

  it('should return canManage=false when user is not an Owner or Manager', () => {
    setupStore({ user: { id: 'user2', name: 'User 2' }, members: mockMembers });
    const { result } = renderHook(() => useTeamMembers());
    expect(result.current.canManage).toBe(false);
  });

  it('should return canManage=true when user is an Owner', () => {
    setupStore({ user: { id: 'user1', name: 'User 1' }, members: mockMembers });
    const { result } = renderHook(() => useTeamMembers());
    expect(result.current.canManage).toBe(true);
  });

  it('should return canManage=true when user is a Manager', () => {
    const managerMember = { id: 'm3', project_id: 'proj-1', user_id: 'user3', role: 'Manager', permissions: ['manage'], joined_at: '2024-01-03T00:00:00Z', updated_at: '2024-01-03T00:00:00Z' };
    setupStore({ user: { id: 'user3', name: 'User 3' }, members: [...mockMembers, managerMember] });
    const { result } = renderHook(() => useTeamMembers());
    expect(result.current.canManage).toBe(true);
  });

  it('should return canManage=false when no user is logged in', () => {
    setupStore({ user: null, members: mockMembers });
    const { result } = renderHook(() => useTeamMembers());
    expect(result.current.canManage).toBe(false);
  });
});