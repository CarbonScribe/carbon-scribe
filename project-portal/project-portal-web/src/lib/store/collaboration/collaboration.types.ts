// TypeScript interfaces for the Collaboration domain (aligned with backend models)

export const CollaborationRoles = ['Owner', 'Manager', 'Contributor', 'Viewer'] as const;
export type CollaborationRole = (typeof CollaborationRoles)[number];

/** Roles that can invite members and remove non-owners */
export const ROLES_CAN_MANAGE = ['Owner', 'Manager'] as const;

export const TaskStatuses = ['todo', 'in_progress', 'review', 'done'] as const;
export type TaskStatus = (typeof TaskStatuses)[number];

export const TaskPriorities = ['low', 'medium', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TaskPriorities)[number];

export const ActivityTypes = ['system', 'user', 'automated', 'alert'] as const;
export type ActivityType = (typeof ActivityTypes)[number];

export const ResourceTypes = ['document', 'equipment', 'contact', 'template', 'link'] as const;
export type ResourceType = (typeof ResourceTypes)[number];

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  permissions: string[];
  joined_at: string;
  updated_at: string;
}

export interface ProjectInvitation {
  id: string;
  project_id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired';
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  project_id: string;
  user_id?: string;
  type: ActivityType | string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Comment {
  id: string;
  project_id: string;
  user_id: string;
  resource_id?: string | null;
  parent_id?: string | null;
  content: string;
  mentions: string[];
  attachments: string[];
  location?: Record<string, unknown>;
  is_resolved: boolean;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  assigned_to?: string | null;
  created_by: string;
  title: string;
  description: string;
  status: TaskStatus | string;
  priority: TaskPriority | string;
  due_date?: string | null;
  time_logged: number;
  created_at: string;
  updated_at: string;
}

export interface SharedResource {
  id: string;
  project_id: string;
  type: ResourceType | string;
  name: string;
  url?: string;
  metadata: Record<string, unknown>;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface ResourceBooking {
  id: string;
  resource_id: string;
  booked_by: string;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
}

// Request DTOs
export interface InviteUserRequest {
  email: string;
  role: string;
}

export interface CreateCommentRequest {
  project_id: string;
  user_id: string;
  content: string;
  parent_id?: string | null;
  resource_id?: string | null;
  mentions?: string[];
  attachments?: string[];
}

export interface CreateTaskRequest {
  project_id: string;
  title: string;
  description?: string;
  assigned_to?: string | null;
  created_by: string;
  status?: string;
  priority?: string;
  due_date?: string | null;
}

export interface UpdateTaskRequest {
  status?: string;
  assigned_to?: string | null;
  title?: string;
  description?: string;
  priority?: string;
  due_date?: string | null;
}

export interface CreateResourceRequest {
  project_id: string;
  type: string;
  name: string;
  url?: string;
  metadata?: Record<string, unknown>;
  uploaded_by: string;
}

// Loading and error state per entity
export interface CollaborationLoadingState {
  members: boolean;
  invitations: boolean;
  activities: boolean;
  comments: boolean;
  tasks: boolean;
  resources: boolean;
  invite: boolean;
  removeMember: boolean;
  createComment: boolean;
  createTask: boolean;
  updateTask: boolean;
  createResource: boolean;
}

export interface CollaborationErrorState {
  members: string | null;
  invitations: string | null;
  activities: string | null;
  comments: string | null;
  tasks: string | null;
  resources: string | null;
  invite: string | null;
  removeMember: string | null;
  createComment: string | null;
  createTask: string | null;
  updateTask: string | null;
  createResource: string | null;
}

export interface CollaborationSlice {
  // Context
  currentProjectId: string | null;

  // Entities
  members: ProjectMember[];
  invitations: ProjectInvitation[];
  activities: ActivityLog[];
  activitiesPagination: { limit: number; offset: number; total: number };
  activityTypeFilter: string;
  comments: Comment[];
  tasks: Task[];
  resources: SharedResource[];

  // Loading & errors (prefixed to avoid clashing with projects slice)
  collaborationLoading: CollaborationLoadingState;
  collaborationErrors: CollaborationErrorState;

  // Actions - fetch
  fetchMembers: (projectId: string) => Promise<void>;
  fetchInvitations: (projectId: string) => Promise<void>;
  fetchActivities: (projectId: string, limit?: number, offset?: number) => Promise<void>;
  fetchComments: (projectId: string) => Promise<void>;
  fetchTasks: (projectId: string) => Promise<void>;
  fetchResources: (projectId: string) => Promise<void>;

  // Actions - mutations
  inviteUser: (projectId: string, data: InviteUserRequest) => Promise<ProjectInvitation | null>;
  removeMember: (projectId: string, userId: string) => Promise<boolean>;
  createComment: (data: CreateCommentRequest) => Promise<Comment | null>;
  createTask: (data: CreateTaskRequest) => Promise<Task | null>;
  updateTask: (taskId: string, data: UpdateTaskRequest) => Promise<Task | null>;
  createResource: (data: CreateResourceRequest) => Promise<SharedResource | null>;

  // UI state
  setCurrentProjectId: (projectId: string | null) => void;
  setActivityTypeFilter: (type: string) => void;
  clearCollaborationErrors: () => void;
  resetCollaborationState: () => void;
}
