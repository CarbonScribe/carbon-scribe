export interface IpWhitelistConfig {
  id: string;
  companyId: string;
  cidr: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
