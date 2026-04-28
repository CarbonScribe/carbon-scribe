export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

interface RequestOptions {
  baseUrl?: string
  token?: string
  fetchImpl?: typeof fetch
}

const DEFAULT_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

function buildUrl(baseUrl: string, path: string): string {
  const sanitizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizeBaseUrl(baseUrl)}${sanitizedPath}`
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit,
  options: RequestOptions = {},
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch
  const baseUrl = options.baseUrl ?? DEFAULT_API_BASE_URL
  const response = await fetchImpl(buildUrl(baseUrl, path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(init.headers ?? {}),
    },
  })

  const rawBody = await response.text()
  const parsedBody = rawBody ? safeJsonParse(rawBody) : null

  if (!response.ok) {
    const message =
      typeof parsedBody === 'object' &&
      parsedBody !== null &&
      'message' in parsedBody &&
      typeof (parsedBody as { message?: unknown }).message === 'string'
        ? (parsedBody as { message: string }).message
        : `Request failed with status ${response.status}`
    throw new ApiError(response.status, message, parsedBody)
  }

  return parsedBody as T
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}
