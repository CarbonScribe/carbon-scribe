import { parseApiError, ParsedError } from '@/lib/utils/errorParser'
import { withRetry, isRetryableError, RetryOptions } from '@/lib/utils/retry'

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  readonly parsed: ParsedError

  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.parsed = parseApiError(body, status)
  }
}

interface RequestOptions {
  baseUrl?: string
  token?: string
  fetchImpl?: typeof fetch
  retry?: RetryOptions
  idempotencyKey?: string
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
  const headers = new Headers(init.headers)

  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json')
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  // Add idempotency key for mutation requests if provided
  if (options.idempotencyKey) {
    headers.set('Idempotency-Key', options.idempotencyKey)
  }

  const executeRequest = async (): Promise<T> => {
    let response: Response

    try {
      response = await fetchImpl(buildUrl(baseUrl, path), {
        ...init,
        headers,
      })
    } catch (error) {
      const apiError = new ApiError(
        0,
        `Unable to reach the API at ${baseUrl}. Check that the backend is running and CORS allows this origin.`,
        error,
      )
      // Check if this is a retryable network error
      if (isRetryableError(error, 0)) {
        throw error // Let retry logic handle it
      }
      throw apiError
    }

    const rawBody = await response.text()
    const parsedBody = rawBody ? safeJsonParse(rawBody) : null

    if (!response.ok) {
      const parsed = parseApiError(parsedBody, response.status)
      const apiError = new ApiError(response.status, parsed.message, parsedBody)
      
      // Check if this is a retryable error (5xx, 408, 429)
      const isRetryable = response.status >= 500 || response.status === 408 || response.status === 429
      if (isRetryable) {
        throw apiError // Let retry logic handle it
      }
      
      throw apiError
    }

    return parsedBody as T
  }

  // Apply retry logic if retry options are provided
  if (options.retry) {
    return withRetry(executeRequest, {
      ...options.retry,
      onRetry: (attempt, error) => {
        console.log(`Retrying request (attempt ${attempt})...`)
        options.retry?.onRetry?.(attempt, error)
      },
    })
  }

  return executeRequest()
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}
