export interface TeamRoleView {
  id: string;
  companyId: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  permissions: string[];
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}
