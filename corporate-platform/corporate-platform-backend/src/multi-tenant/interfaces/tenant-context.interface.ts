export type TenantSource =
  | 'jwt'
  | 'header'
  | 'subdomain'
  | 'path'
  | 'api_key'
  | 'system';

export interface TenantContext {
  companyId: string;
  userId: string;
  role: string;
  source: TenantSource;
  bypassIsolation?: boolean;
}
