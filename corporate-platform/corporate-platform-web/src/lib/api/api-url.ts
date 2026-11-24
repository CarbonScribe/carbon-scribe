import { env } from '@/env';

const API_PREFIX = '/api/v1';

export function apiUrl(
  path: string,
  baseUrl: string = env.NEXT_PUBLIC_API_BASE_URL,
): string {
  const base = baseUrl.replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
  const normalizedPath = path
    .replace(/^\/+/, '')
    .replace(/^api\/v1(?=\/|$|\?)/i, '')
    .replace(/^\/+/, '');
  const suffix = normalizedPath
    ? `${normalizedPath.startsWith('?') ? '' : '/'}${normalizedPath}`
    : '';

  return `${base}${API_PREFIX}${suffix}`;
}
