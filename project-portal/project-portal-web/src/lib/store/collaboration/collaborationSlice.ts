import { StateCreator } from 'zustand';
import type {
  CollaborationSlice,
  ProjectMember,
  ProjectInvitation,
  ActivityLog,
  Comment,
  Task,
  SharedResource,
  InviteUserRequest,
  CreateCommentRequest,
  CreateTaskRequest,
  UpdateTaskRequest,
  CreateResourceRequest,
  CollaborationLoadingState,
  CollaborationErrorState,
} from './collaboration.types';
import {
  fetchMembersApi,
  fetchInvitationsApi,
  fetchActivitiesApi,
  fetchCommentsApi,
  fetchTasksApi,
  fetchResourcesApi,
  inviteUserApi,
  removeMemberApi,
  createCommentApi,
  createTaskApi,
  updateTaskApi,
  createResourceApi,
} from './collaboration.api';
import { getErrorMessage } from '@/lib/utils/errorMessage';

const initialLoading: CollaborationLoadingState = {
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
};

const initialErrors: CollaborationErrorState = {
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
};

export const createCollaborationSlice: StateCreator<CollaborationSlice> = (set, get) => ({
  currentProjectId: null,
  members: [],
  invitations: [],
  activities: [],
  activitiesPagination: { limit: 20, offset: 0, total: 0 },
  activityTypeFilter: 'All',
  comments: [],
  tasks: [],
  resources: [],
  collaborationLoading: initialLoading,
  collaborationErrors: initialErrors,

  fetchMembers: async (projectId: string) => {
    set((s) => ({ collaborationLoading: { ...s.collaborationLoading, members: true }, collaborationErrors: { ...s.collaborationErrors, members: null } }));
    try {
      const members = await fetchMembersApi(projectId);
      set({ members, collaborationLoading: { ...get().collaborationLoading, members: false } });
    } catch (error) {
      set({
        collaborationLoading: { ...get().collaborationLoading, members: false },
        collaborationErrors: { ...get().collaborationErrors, members: getErrorMessage(error) },
      });
    }
  },

  fetchInvitations: async (projectId: string) => {
    set((s) => ({ collaborationLoading: { ...s.collaborationLoading, invitations: true }, collaborationErrors: { ...s.collaborationErrors, invitations: null } }));
    try {
      const invitations = await fetchInvitationsApi(projectId);
      set({ invitations, collaborationLoading: { ...get().collaborationLoading, invitations: false } });
    } catch (error) {
      set({
        collaborationLoading: { ...get().collaborationLoading, invitations: false },
        collaborationErrors: { ...get().collaborationErrors, invitations: getErrorMessage(error) },
      });
    }
  },

  fetchActivities: async (projectId: string, limit = 20, offset = 0) => {
    set((s) => ({ collaborationLoading: { ...s.collaborationLoading, activities: true }, collaborationErrors: { ...s.collaborationErrors, activities: null } }));
    try {
      const activities = await fetchActivitiesApi(projectId, limit, offset);
      set({
        activities,
        activitiesPagination: { limit, offset, total: activities.length },
        collaborationLoading: { ...get().collaborationLoading, activities: false },
      });
    } catch (error) {
      set({
        collaborationLoading: { ...get().collaborationLoading, activities: false },
        collaborationErrors: { ...get().collaborationErrors, activities: getErrorMessage(error) },
      });
    }
  },

  fetchComments: async (projectId: string) => {
    set((s) => ({ collaborationLoading: { ...s.collaborationLoading, comments: true }, collaborationErrors: { ...s.collaborationErrors, comments: null } }));
    try {
      const comments = await fetchCommentsApi(projectId);
      set({ comments, collaborationLoading: { ...get().collaborationLoading, comments: false } });
    } catch (error) {
      set({
        collaborationLoading: { ...get().collaborationLoading, comments: false },
        collaborationErrors: { ...get().collaborationErrors, comments: getErrorMessage(error) },
      });
    }
  },

  fetchTasks: async (projectId: string) => {
    set((s) => ({ collaborationLoading: { ...s.collaborationLoading, tasks: true }, collaborationErrors: { ...s.collaborationErrors, tasks: null } }));
    try {
      const tasks = await fetchTasksApi(projectId);
      set({ tasks, collaborationLoading: { ...get().collaborationLoading, tasks: false } });
    } catch (error) {
      set({
        collaborationLoading: { ...get().collaborationLoading, tasks: false },
        collaborationErrors: { ...get().collaborationErrors, tasks: getErrorMessage(error) },
      });
    }
  },

  fetchResources: async (projectId: string) => {
    set((s) => ({ collaborationLoading: { ...s.collaborationLoading, resources: true }, collaborationErrors: { ...s.collaborationErrors, resources: null } }));
    try {
      const resources = await fetchResourcesApi(projectId);
      set({ resources, collaborationLoading: { ...get().collaborationLoading, resources: false } });
    } catch (error) {
      set({
        collaborationLoading: { ...get().collaborationLoading, resources: false },
        collaborationErrors: { ...get().collaborationErrors, resources: getErrorMessage(error) },
      });
    }
  },

  inviteUser: async (projectId: string, data: InviteUserRequest): Promise<ProjectInvitation | null> => {
    set((s) => ({ collaborationLoading: { ...s.collaborationLoading, invite: true }, collaborationErrors: { ...s.collaborationErrors, invite: null } }));
    try {
      const invite = await inviteUserApi(projectId, data);
      set((s) => ({
        invitations: [invite, ...s.invitations],
        collaborationLoading: { ...s.collaborationLoading, invite: false },
      }));
      return invite;
    } catch (error) {
      set({
        collaborationLoading: { ...get().collaborationLoading, invite: false },
        collaborationErrors: { ...get().collaborationErrors, invite: getErrorMessage(error) },
      });
      return null;
    }
  },

  removeMember: async (projectId: string, userId: string): Promise<boolean> => {
    set((s) => ({ collaborationLoading: { ...s.collaborationLoading, removeMember: true }, collaborationErrors: { ...s.collaborationErrors, removeMember: null } }));
    try {
      await removeMemberApi(projectId, userId);
      set((s) => ({
        members: s.members.filter((m) => m.user_id !== userId),
        collaborationLoading: { ...s.collaborationLoading, removeMember: false },
      }));
      return true;
    } catch (error) {
      set({
        collaborationLoading: { ...get().collaborationLoading, removeMember: false },
        collaborationErrors: { ...get().collaborationErrors, removeMember: getErrorMessage(error) },
      });
      return false;
    }
  },

  createComment: async (data: CreateCommentRequest): Promise<Comment | null> => {
    set((s) => ({ collaborationLoading: { ...s.collaborationLoading, createComment: true }, collaborationErrors: { ...s.collaborationErrors, createComment: null } }));
    try {
      const comment = await createCommentApi(data);
      set((s) => ({
        comments: [...s.comments, comment],
        collaborationLoading: { ...s.collaborationLoading, createComment: false },
      }));
      return comment;
    } catch (error) {
      set({
        collaborationLoading: { ...get().collaborationLoading, createComment: false },
        collaborationErrors: { ...get().collaborationErrors, createComment: getErrorMessage(error) },
      });
      return null;
    }
  },

  createTask: async (data: CreateTaskRequest): Promise<Task | null> => {
    set((s) => ({ collaborationLoading: { ...s.collaborationLoading, createTask: true }, collaborationErrors: { ...s.collaborationErrors, createTask: null } }));
    try {
      const task = await createTaskApi(data);
      set((s) => ({
        tasks: [task, ...s.tasks],
        collaborationLoading: { ...s.collaborationLoading, createTask: false },
      }));
      return task;
    } catch (error) {
      set({
        collaborationLoading: { ...get().collaborationLoading, createTask: false },
        collaborationErrors: { ...get().collaborationErrors, createTask: getErrorMessage(error) },
      });
      return null;
    }
  },

  updateTask: async (taskId: string, data: UpdateTaskRequest): Promise<Task | null> => {
    set((s) => ({ collaborationLoading: { ...s.collaborationLoading, updateTask: true }, collaborationErrors: { ...s.collaborationErrors, updateTask: null } }));
    try {
      const updated = await updateTaskApi(taskId, data);
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === taskId ? updated : t)),
        collaborationLoading: { ...s.collaborationLoading, updateTask: false },
      }));
      return updated;
    } catch (error) {
      set({
        collaborationLoading: { ...get().collaborationLoading, updateTask: false },
        collaborationErrors: { ...get().collaborationErrors, updateTask: getErrorMessage(error) },
      });
      return null;
    }
  },

  createResource: async (data: CreateResourceRequest): Promise<SharedResource | null> => {
    set((s) => ({ collaborationLoading: { ...s.collaborationLoading, createResource: true }, collaborationErrors: { ...s.collaborationErrors, createResource: null } }));
    try {
      const resource = await createResourceApi(data);
      set((s) => ({
        resources: [...s.resources, resource],
        collaborationLoading: { ...s.collaborationLoading, createResource: false },
      }));
      return resource;
    } catch (error) {
      set({
        collaborationLoading: { ...get().collaborationLoading, createResource: false },
        collaborationErrors: { ...get().collaborationErrors, createResource: getErrorMessage(error) },
      });
      return null;
    }
  },

  setCurrentProjectId: (projectId) => set({ currentProjectId: projectId }),
  setActivityTypeFilter: (type) => set({ activityTypeFilter: type }),
  clearCollaborationErrors: () => set({ collaborationErrors: initialErrors }),
  resetCollaborationState: () =>
    set({
      currentProjectId: null,
      members: [],
      invitations: [],
      activities: [],
      activitiesPagination: { limit: 20, offset: 0, total: 0 },
      activityTypeFilter: 'All',
      comments: [],
      tasks: [],
      resources: [],
      collaborationLoading: initialLoading,
      collaborationErrors: initialErrors,
    }),
});
