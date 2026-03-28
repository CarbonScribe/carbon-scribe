export interface TeamMemberView {
  id: string;
  companyId: string;
  userId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  roleId: string;
  roleName?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | string;
  joinedAt: Date;
  invitedBy?: string | null;
  invitedAt?: Date | null;
  lastActiveAt?: Date | null;
  metadata?: Record<string, unknown> | null;
  department?: string | null;
  title?: string | null;
}
