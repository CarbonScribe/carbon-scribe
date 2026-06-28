import { parseApiError, ParsedError } from '@/lib/utils/errorParser'
import { withRetry, isRetryableError, RetryOptions } from '@/lib/utils/retry'
import { reportError } from '@/lib/telemetry/errorReporter'
import { requestManager } from './requestManager'

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
  signal?: AbortSignal
  cancelOnRouteChange?: boolean
  deduplicate?: boolean
  timeout?: number
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
  const method = init.method ?? 'GET'
  const isQuery = method === 'GET'

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

  const cancelOnRouteChange = options.cancelOnRouteChange ?? isQuery
  const deduplicate = options.deduplicate ?? isQuery
  const timeoutMs = options.timeout ?? 30000

  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort('Request timeout')
  }, timeoutMs)

  if (options.signal) {
    options.signal.addEventListener('abort', () => {
      controller.abort(options.signal?.reason || 'Caller aborted')
    })
    if (options.signal.aborted) {
      controller.abort(options.signal.reason)
    }
  }

  const requestKey = requestManager.generateKey(method, path, init.body)

  if (cancelOnRouteChange) {
    requestManager.registerRequest(requestKey, controller, deduplicate)
  }

  const executeRequest = async (): Promise<T> => {
    let response: Response

    try {
      response = await fetchImpl(buildUrl(baseUrl, path), {
        ...init,
        headers,
        signal: controller.signal,
      })
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log(`[http.ts] Request cancelled: ${path}`)
        throw error
      }
      const apiError = new ApiError(
        0,
        `Unable to reach the API at ${baseUrl}. Check that the backend is running and CORS allows this origin.`,
        error,
      )
      reportError(apiError, 'http', 'error', { path, method })
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
      reportError(apiError, 'http', response.status >= 500 ? 'error' : 'warning', {
        path,
        method: init.method ?? 'GET',
        status: response.status,
      })
      // Check if this is a retryable error (5xx, 408, 429)
      const isRetryable = response.status >= 500 || response.status === 408 || response.status === 429
      if (isRetryable) {
        throw apiError // Let retry logic handle it
      }
      
      throw apiError
    }

    return parsedBody as T
  }

  try {
    if (options.retry) {
      return await withRetry(executeRequest, {
        ...options.retry,
        onRetry: (attempt, error) => {
          console.log(`Retrying request (attempt ${attempt})...`)
          options.retry?.onRetry?.(attempt, error)
        },
      })
    }

    return await executeRequest()
  } finally {
    clearTimeout(timeoutId)
    if (cancelOnRouteChange) {
      requestManager.unregisterRequest(requestKey)
    }
  }
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}
