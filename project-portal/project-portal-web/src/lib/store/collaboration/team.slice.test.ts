import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CollaborationSlice } from './collaboration.types';
import { createCollaborationSlice } from './collaborationSlice';
import * as api from './collaboration.api';

// Mock the API module
vi.mock('./collaboration.api', () => ({
  fetchMembersApi: vi.fn(),
  fetchInvitationsApi: vi.fn(),
  fetchActivitiesApi: vi.fn(),
  fetchCommentsApi: vi.fn(),
  fetchTasksApi: vi.fn(),
  fetchResourcesApi: vi.fn(),
  inviteUserApi: vi.fn(),
  removeMemberApi: vi.fn(),
  createCommentApi: vi.fn(),
  createTaskApi: vi.fn(),
  updateTaskApi: vi.fn(),
  createResourceApi: vi.fn(),
}));

const mockApi = vi.mocked(api);

describe('TeamSlice', () => {
  let slice: CollaborationSlice;
  let mockSet: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSet = vi.fn((update) => {
      // If update is a function, call it with current state
      if (typeof update === 'function') {
        const newState = update(slice);
        Object.assign(slice, newState);
      } else {
        // If update is an object, merge it with current state
        Object.assign(slice, update);
      }
    });
    slice = createCollaborationSlice(mockSet, () => slice, {} as any);
  });

  describe('Team-Specific Member Management', () => {
    it('should fetch team members and update state', async () => {
      const mockTeamMembers = [
        {
          id: '1',
          project_id: 'team-project-1',
          user_id: 'owner-123',
          role: 'Owner',
          permissions: ['all'],
          joined_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          id: '2',
          project_id: 'team-project-1',
          user_id: 'manager-456',
          role: 'Manager',
          permissions: ['read', 'write', 'manage'],
          joined_at: '2023-01-02T00:00:00Z',
          updated_at: '2023-01-02T00:00:00Z',
        },
        {
          id: '3',
          project_id: 'team-project-1',
          user_id: 'contributor-789',
          role: 'Contributor',
          permissions: ['read', 'write'],
          joined_at: '2023-01-03T00:00:00Z',
          updated_at: '2023-01-03T00:00:00Z',
        },
      ];
      mockApi.fetchMembersApi.mockResolvedValue(mockTeamMembers);

      await slice.fetchMembers('team-project-1');

      expect(mockApi.fetchMembersApi).toHaveBeenCalledWith('team-project-1');
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          members: mockTeamMembers,
        })
      );
    });

    it('should handle empty team members list', async () => {
      mockApi.fetchMembersApi.mockResolvedValue([]);

      await slice.fetchMembers('empty-team');

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          members: [],
        })
      );
    });

    it('should maintain team member order from API', async () => {
      const mockMembers = [
        { id: '1', user_id: 'user-a', role: 'Owner', permissions: [], joined_at: '2023-01-03T00:00:00Z', updated_at: '2023-01-03T00:00:00Z' },
        { id: '2', user_id: 'user-b', role: 'Contributor', permissions: [], joined_at: '2023-01-01T00:00:00Z', updated_at: '2023-01-01T00:00:00Z' },
        { id: '3', user_id: 'user-c', role: 'Manager', permissions: [], joined_at: '2023-01-02T00:00:00Z', updated_at: '2023-01-02T00:00:00Z' },
      ] as any;
      mockApi.fetchMembersApi.mockResolvedValue(mockMembers);

      await slice.fetchMembers('team-1');

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          members: mockMembers, // Should preserve the order from API
        })
      );
    });
  });

  describe('Team Invitation Management', () => {
    it('should fetch team invitations', async () => {
      const mockInvitations = [
        {
          id: 'inv-1',
          project_id: 'team-project-1',
          email: 'new.member@example.com',
          role: 'Contributor',
          status: 'pending' as const,
          expires_at: '2023-01-15T00:00:00Z',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          resent_count: 0,
        },
        {
          id: 'inv-2',
          project_id: 'team-project-1',
          email: 'another.member@example.com',
          role: 'Viewer',
          status: 'accepted' as const,
          expires_at: '2023-01-10T00:00:00Z',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-02T00:00:00Z',
          resent_count: 0,
        },
      ];
      mockApi.fetchInvitationsApi.mockResolvedValue(mockInvitations);

      await slice.fetchInvitations('team-project-1');

      expect(mockApi.fetchInvitationsApi).toHaveBeenCalledWith('team-project-1');
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          invitations: mockInvitations,
        })
      );
    });

    it('should invite new team member with correct role', async () => {
      const mockInvitation = {
        id: 'inv-new',
        project_id: 'team-project-1',
        email: 'new.team.member@example.com',
        role: 'Contributor',
        status: 'pending' as const,
        expires_at: '2023-01-15T00:00:00Z',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        resent_count: 0,
      };
      mockApi.inviteUserApi.mockResolvedValue(mockInvitation);

      const result = await slice.inviteUser('team-project-1', {
        email: 'new.team.member@example.com',
        role: 'Contributor',
      });

      expect(mockApi.inviteUserApi).toHaveBeenCalledWith('team-project-1', {
        email: 'new.team.member@example.com',
        role: 'Contributor',
      });
      expect(result).toEqual(mockInvitation);
    });

    it('should handle invitation with different roles', async () => {
      const roles = ['Owner', 'Manager', 'Contributor', 'Viewer'] as const;
      
      for (const role of roles) {
        const mockInvitation = {
          id: `inv-${role}`,
          project_id: 'team-project-1',
          email: `${role.toLowerCase()}@example.com`,
          role,
          status: 'pending' as const,
          expires_at: '2023-01-15T00:00:00Z',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          resent_count: 0,
        };
        mockApi.inviteUserApi.mockResolvedValue(mockInvitation);

        const result = await slice.inviteUser('team-project-1', {
          email: `${role.toLowerCase()}@example.com`,
          role,
        });

        expect(result).toEqual(mockInvitation);
      }
    });
  });

  describe('Team Activity Tracking', () => {
    it('should fetch team activities with pagination', async () => {
      const mockActivities = [
        {
          id: 'act-1',
          project_id: 'team-project-1',
          user_id: 'user-123',
          type: 'user' as const,
          action: 'user_invited',
          metadata: { email: 'new@example.com', role: 'Contributor' },
          created_at: '2023-01-03T00:00:00Z',
        },
        {
          id: 'act-2',
          project_id: 'team-project-1',
          user_id: 'user-456',
          type: 'user' as const,
          action: 'comment_added',
          metadata: { comment_id: 'comment-1' },
          created_at: '2023-01-02T00:00:00Z',
        },
        {
          id: 'act-3',
          project_id: 'team-project-1',
          user_id: 'user-789',
          type: 'system' as const,
          action: 'member_removed',
          metadata: { removed_user: 'user-old' },
          created_at: '2023-01-01T00:00:00Z',
        },
      ];
      mockApi.fetchActivitiesApi.mockResolvedValue(mockActivities);

      await slice.fetchActivities('team-project-1', 10, 0);

      expect(mockApi.fetchActivitiesApi).toHaveBeenCalledWith('team-project-1', 10, 0);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          activities: mockActivities,
        })
      );
    });

    it('should filter team activities by type', () => {
      // Test setting activity filter
      slice.setActivityTypeFilter('user');
      
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          activityTypeFilter: 'user',
        })
      );

      slice.setActivityTypeFilter('system');
      
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          activityTypeFilter: 'system',
        })
      );

      slice.setActivityTypeFilter('All');
      
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          activityTypeFilter: 'All',
        })
      );
    });
  });

  describe('Team Task Management', () => {
    it('should fetch team tasks', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          project_id: 'team-project-1',
          created_by: 'user-123',
          title: 'Set up team repository',
          description: 'Initialize git repository and team structure',
          status: 'done' as const,
          priority: 'high' as const,
          assigned_to: 'user-456',
          time_logged: 7200,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-03T00:00:00Z',
        },
        {
          id: 'task-2',
          project_id: 'team-project-1',
          created_by: 'user-789',
          title: 'Create team documentation',
          description: 'Write comprehensive team documentation',
          status: 'in_progress' as const,
          priority: 'medium' as const,
          assigned_to: 'user-789',
          time_logged: 3600,
          created_at: '2023-01-02T00:00:00Z',
          updated_at: '2023-01-02T00:00:00Z',
        },
      ];
      mockApi.fetchTasksApi.mockResolvedValue(mockTasks);

      await slice.fetchTasks('team-project-1');

      expect(mockApi.fetchTasksApi).toHaveBeenCalledWith('team-project-1');
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          tasks: mockTasks,
        })
      );
    });

    it('should create team task with assignment', async () => {
      const mockTask = {
        id: 'task-new',
        project_id: 'team-project-1',
        created_by: 'manager-123',
        title: 'Review team performance',
        description: 'Quarterly team performance review',
        status: 'todo' as const,
        priority: 'medium' as const,
        assigned_to: 'manager-123',
        time_logged: 0,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };
      mockApi.createTaskApi.mockResolvedValue(mockTask);

      const result = await slice.createTask({
        project_id: 'team-project-1',
        title: 'Review team performance',
        description: 'Quarterly team performance review',
        created_by: 'manager-123',
        assigned_to: 'manager-123',
        status: 'todo',
        priority: 'medium',
      });

      expect(mockApi.createTaskApi).toHaveBeenCalledWith({
        project_id: 'team-project-1',
        title: 'Review team performance',
        description: 'Quarterly team performance review',
        created_by: 'manager-123',
        assigned_to: 'manager-123',
        status: 'todo',
        priority: 'medium',
      });
      expect(result).toEqual(mockTask);
    });

    it('should update team task status', async () => {
      const mockUpdatedTask = {
        id: 'task-1',
        project_id: 'team-project-1',
        created_by: 'manager-123',
        title: 'Updated task title',
        description: 'Updated task description',
        status: 'done' as const,
        priority: 'medium' as const,
        time_logged: 0,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-03T00:00:00Z',
      };
      mockApi.updateTaskApi.mockResolvedValue(mockUpdatedTask);

      const result = await slice.updateTask('task-1', {
        status: 'done',
      });

      expect(mockApi.updateTaskApi).toHaveBeenCalledWith('task-1', {
        status: 'done',
      });
      expect(result).toEqual(mockUpdatedTask);
    });
  });

  describe('Team Resource Management', () => {
    it('should fetch team resources', async () => {
      const mockResources = [
        {
          id: 'res-1',
          project_id: 'team-project-1',
          type: 'document',
          name: 'Team Charter',
          url: 'https://example.com/team-charter.pdf',
          metadata: { version: '1.0', size: '2MB' },
          uploaded_by: 'owner-123',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 'res-2',
          project_id: 'team-project-1',
          type: 'link',
          name: 'Team Communication Tool',
          url: 'https://slack.example.com/team-1',
          metadata: { type: 'communication' },
          uploaded_by: 'manager-456',
          created_at: '2023-01-02T00:00:00Z',
          updated_at: '2023-01-02T00:00:00Z',
        },
      ];
      mockApi.fetchResourcesApi.mockResolvedValue(mockResources);

      await slice.fetchResources('team-project-1');

      expect(mockApi.fetchResourcesApi).toHaveBeenCalledWith('team-project-1');
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          resources: mockResources,
        })
      );
    });

    it('should upload team resource', async () => {
      const mockResource = {
        id: 'res-new',
        project_id: 'team-project-1',
        type: 'document',
        name: 'Project Requirements',
        url: 'https://example.com/requirements.pdf',
        metadata: { version: '2.0', category: 'planning' },
        uploaded_by: 'user-123',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };
      mockApi.createResourceApi.mockResolvedValue(mockResource);

      const result = await slice.createResource({
        project_id: 'team-project-1',
        type: 'document',
        name: 'Project Requirements',
        url: 'https://example.com/requirements.pdf',
        uploaded_by: 'user-123',
        metadata: { version: '2.0', category: 'planning' },
      });

      expect(mockApi.createResourceApi).toHaveBeenCalledWith({
        project_id: 'team-project-1',
        type: 'document',
        name: 'Project Requirements',
        url: 'https://example.com/requirements.pdf',
        uploaded_by: 'user-123',
        metadata: { version: '2.0', category: 'planning' },
      });
      expect(result).toEqual(mockResource);
    });
  });

  describe('Team Comment Management', () => {
    it('should fetch team comments', async () => {
      const mockComments = [
        {
          id: 'comment-1',
          project_id: 'team-project-1',
          user_id: 'user-123',
          content: 'Great work on the project setup!',
          mentions: ['user-456'],
          attachments: [],
          is_resolved: false,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 'comment-2',
          project_id: 'team-project-1',
          user_id: 'user-456',
          content: 'Thanks! Looking forward to collaborating.',
          mentions: [],
          attachments: [],
          is_resolved: false,
          created_at: '2023-01-02T00:00:00Z',
          updated_at: '2023-01-02T00:00:00Z',
        },
      ];
      mockApi.fetchCommentsApi.mockResolvedValue(mockComments);

      await slice.fetchComments('team-project-1');

      expect(mockApi.fetchCommentsApi).toHaveBeenCalledWith('team-project-1');
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          comments: mockComments,
        })
      );
    });

    it('should create team comment with mentions', async () => {
      const mockComment = {
        id: 'comment-new',
        project_id: 'team-project-1',
        user_id: 'user-123',
        content: '@user-456 can you review this?',
        mentions: ['user-456'],
        attachments: [],
        is_resolved: false,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };
      mockApi.createCommentApi.mockResolvedValue(mockComment);

      const result = await slice.createComment({
        project_id: 'team-project-1',
        user_id: 'user-123',
        content: '@user-456 can you review this?',
        mentions: ['user-456'],
      });

      expect(mockApi.createCommentApi).toHaveBeenCalledWith({
        project_id: 'team-project-1',
        user_id: 'user-123',
        content: '@user-456 can you review this?',
        mentions: ['user-456'],
      });
      expect(result).toEqual(mockComment);
    });
  });

  describe('Team Member Removal', () => {
    it('should remove team member successfully', async () => {
      mockApi.removeMemberApi.mockResolvedValue(undefined);

      const result = await slice.removeMember('team-project-1', 'member-123');

      expect(mockApi.removeMemberApi).toHaveBeenCalledWith('team-project-1', 'member-123');
      expect(result).toBe(true);
    });

    it('should handle team member removal failure', async () => {
      mockApi.removeMemberApi.mockRejectedValue(new Error('Cannot remove owner'));

      const result = await slice.removeMember('team-project-1', 'owner-123');

      expect(result).toBe(false);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          collaborationErrors: expect.objectContaining({
            removeMember: 'Cannot remove owner',
          }),
        })
      );
    });
  });

  describe('Team State Management', () => {
    it('should set current team project context', () => {
      slice.setCurrentProjectId('team-project-1');

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          currentProjectId: 'team-project-1',
        })
      );
    });

    it('should clear team errors', () => {
      // Set some errors through the mock set function
      mockSet({
        collaborationErrors: {
          members: 'Error fetching members',
          invitations: 'Error fetching invitations',
          activities: null,
          comments: null,
          tasks: null,
          resources: null,
          invite: null,
          removeMember: null,
          createComment: null,
          createTask: null,
          updateTask: null,
          createResource: null,
        }
      });

      slice.clearCollaborationErrors();

      // Check that the errors were cleared
      expect(slice.collaborationErrors.members).toBe(null);
      expect(slice.collaborationErrors.invitations).toBe(null);
      expect(slice.collaborationErrors.activities).toBe(null);
      expect(slice.collaborationErrors.comments).toBe(null);
      expect(slice.collaborationErrors.tasks).toBe(null);
      expect(slice.collaborationErrors.resources).toBe(null);
      expect(slice.collaborationErrors.invite).toBe(null);
      expect(slice.collaborationErrors.removeMember).toBe(null);
      expect(slice.collaborationErrors.createComment).toBe(null);
      expect(slice.collaborationErrors.createTask).toBe(null);
      expect(slice.collaborationErrors.updateTask).toBe(null);
      expect(slice.collaborationErrors.createResource).toBe(null);
    });

    it('should reset collaboration state', () => {
      // Set some state through the mock set function
      mockSet({
        currentProjectId: 'team-project-1',
        members: [{ id: '1', user_id: 'user1', role: 'Owner' } as any],
        invitations: [{ id: '1', email: 'test@example.com', role: 'Contributor', status: 'pending', resent_count: 0 } as any],
        collaborationErrors: {
          members: 'Some error',
          invitations: null,
          activities: null,
          comments: null,
          tasks: null,
          resources: null,
          invite: null,
          removeMember: null,
          createComment: null,
          createTask: null,
          updateTask: null,
          createResource: null,
        }
      });

      slice.resetCollaborationState();

      // Check that the state was reset correctly
      expect(slice.currentProjectId).toBe(null);
      expect(slice.members).toEqual([]);
      expect(slice.invitations).toEqual([]);
      expect(slice.activities).toEqual([]);
      expect(slice.activitiesPagination).toEqual({ limit: 20, offset: 0, total: 0 });
      expect(slice.activityTypeFilter).toBe('All');
      expect(slice.comments).toEqual([]);
      expect(slice.tasks).toEqual([]);
      expect(slice.resources).toEqual([]);
      expect(slice.collaborationLoading).toEqual({
        members: false,
        invitations: false,
        activities: false,
        comments: false,
        tasks: false,
        resources: false,
        invite: false,
        removeMember: false,
        createComment: false,
        createTask: false,
        updateTask: false,
        createResource: false,
        resendInvitation: false,
        cancelInvitation: false,
        acceptInvitation: false,
        declineInvitation: false,
      });
      expect(slice.collaborationErrors).toEqual({
        members: null,
        invitations: null,
        activities: null,
        comments: null,
        tasks: null,
        resources: null,
        invite: null,
        removeMember: null,
        createComment: null,
        createTask: null,
        updateTask: null,
        createResource: null,
        resendInvitation: null,
        cancelInvitation: null,
        acceptInvitation: null,
        declineInvitation: null,
      });
    });
  });

  describe('Team Loading States', () => {
    it('should manage loading states for team operations', async () => {
      const mockMembers = [{ id: '1', user_id: 'user1', role: 'Owner' } as any];
      
      mockApi.fetchMembersApi.mockImplementation(() => new Promise(resolve => {
        // Check loading state is set
        expect(mockSet).toHaveBeenCalledWith(
          expect.objectContaining({
            collaborationLoading: expect.objectContaining({ members: true }),
          })
        );
        resolve(mockMembers);
      }));

      await slice.fetchMembers('team-1');

      // Check loading state is cleared
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          collaborationLoading: expect.objectContaining({ members: false }),
        })
      );
    });

    it('should handle concurrent team operations', async () => {
      const mockMembers = [{ id: '1', user_id: 'user1', role: 'Owner' } as any];
      const mockInvitations = [{ id: '1', email: 'test@example.com', role: 'Contributor', status: 'pending', resent_count: 0 } as any];
      
      mockApi.fetchMembersApi.mockResolvedValue(mockMembers);
      mockApi.fetchInvitationsApi.mockResolvedValue(mockInvitations);

      // Run operations concurrently
      await Promise.all([
        slice.fetchMembers('team-1'),
        slice.fetchInvitations('team-1'),
      ]);

      // Check that both operations completed successfully by checking the final state
      expect(slice.members).toEqual(mockMembers);
      expect(slice.invitations).toEqual(mockInvitations);
    });
  });

  describe('Team Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const error = new Error('Network error');
      mockApi.fetchMembersApi.mockRejectedValue(error);

      await slice.fetchMembers('team-1');

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          collaborationErrors: expect.objectContaining({
            members: 'Network error',
          }),
          collaborationLoading: expect.objectContaining({
            members: false,
          }),
        })
      );
    });

    it('should handle empty responses gracefully', async () => {
      mockApi.fetchMembersApi.mockResolvedValue([]);
      mockApi.fetchInvitationsApi.mockResolvedValue([]);
      mockApi.fetchTasksApi.mockResolvedValue([]);
      mockApi.fetchResourcesApi.mockResolvedValue([]);

      await Promise.all([
        slice.fetchMembers('team-1'),
        slice.fetchInvitations('team-1'),
        slice.fetchTasks('team-1'),
        slice.fetchResources('team-1'),
      ]);

      // Check that the state was updated with empty arrays
      expect(slice.members).toEqual([]);
      expect(slice.invitations).toEqual([]);
      expect(slice.tasks).toEqual([]);
      expect(slice.resources).toEqual([]);
    });
  });
});
