export interface JwtPayload {
  sub: string;
  email: string;
  companyId: string;
  role: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}
