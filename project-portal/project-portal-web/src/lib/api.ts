export const getReportsApiBase = (): string => {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_REPORTS_API_URL ?? '/api/v1';
  }
  return process.env.NEXT_PUBLIC_REPORTS_API_URL ?? 'http://localhost:8080/api/v1';
};

export const getIntegrationsApiBase = (): string => {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_INTEGRATIONS_API_URL ?? '/api/v1/integrations';
  }
  return process.env.NEXT_PUBLIC_INTEGRATIONS_API_URL ?? 'http://localhost:8080/api/v1/integrations';
};

export type ApiError = { error: string };
