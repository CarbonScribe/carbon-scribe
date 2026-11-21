import { parseApiError, ParsedError } from '@/lib/utils/errorParser'
import { withRetry, isRetryableError, RetryOptions } from '@/lib/utils/retry'
import {
  buildRateLimitRetryOptions,
  getRetryAfterMs,
  isRateLimitError,
} from '@/lib/utils/rateLimit'
import { reportError } from '@/lib/telemetry/errorReporter'
import { requestManager } from './requestManager'
import { parseResponseBody } from './responseParser'

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  readonly parsed: ParsedError
  /** Milliseconds until a 429'd client may try again (from Retry-After). */
  readonly retryAfterMs?: number

  constructor(status: number, message: string, body: unknown, retryAfterMs?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.retryAfterMs = retryAfterMs
    this.parsed = parseApiError(body, status)
    if (retryAfterMs !== undefined) {
      this.parsed.retryAfterMs = retryAfterMs
    }
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

    const parsedResponse = await parseResponseBody<T>(response)

    // Telemetry tracking for non-JSON responses
    if (!parsedResponse.isJson && !parsedResponse.isEmpty && !parsedResponse.isBinary) {
      reportError(
        `Received non-JSON response (${parsedResponse.contentType || 'unknown'}) for ${method} ${path}`,
        'http',
        'warning',
        {
          path,
          method,
          status: response.status,
          contentType: parsedResponse.contentType,
          bodyPreview: parsedResponse.preview,
          isHtml: parsedResponse.isHtml,
        },
      )
    }

    if (!response.ok) {
      const errorBody = parsedResponse.data ?? parsedResponse.raw
      const parsed = parseApiError(errorBody, response.status)
      const isRateLimited = response.status === 429
      const retryAfterMs = isRateLimited
        ? getRetryAfterMs(response.headers, errorBody)
        : undefined
      const apiError = new ApiError(
        response.status,
        parsed.message,
        errorBody,
        retryAfterMs,
      )

      // Throttling is an expected, user-actionable condition — report it as a
      // warning rather than a server error, with the wait window attached.
      reportError(
        apiError,
        'http',
        isRateLimited ? 'warning' : response.status >= 500 ? 'error' : 'warning',
        {
          path,
          method: init.method ?? 'GET',
          status: response.status,
          contentType: parsedResponse.contentType,
          bodyPreview: parsedResponse.preview,
          ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
        },
      )

      // Always throw; the rate-limit-aware retry policy decides whether this
      // particular request is safe to replay.
      throw apiError
    }

    return parsedResponse.data as T
  }

  const retryOptions = buildRateLimitRetryOptions(method, path, options.retry)

  try {
    return await withRetry(executeRequest, {
      ...retryOptions,
      onRetry: (attempt, error) => {
        if (isRateLimitError(error)) {
          console.log(`Rate limited on ${method} ${path}; retrying after Retry-After.`)
        } else {
          console.log(`Retrying request (attempt ${attempt})...`)
        }
        options.retry?.onRetry?.(attempt, error)
      },
    })
  } finally {
    clearTimeout(timeoutId)
    if (cancelOnRouteChange) {
      requestManager.unregisterRequest(requestKey)
    }
  }
}

