import type { ApiErrorDetail } from './types'

/**
 * Transport for the /api/v1 REST API.
 *
 * Authentication is cookie based: the browser sends the HttpOnly session cookie
 * automatically, so this module never sees, stores or logs a token. State-changing
 * requests echo the CSRF token cookie in a header (Spring Security's cookie token
 * convention). Both names are assumptions until the backend auth design is fixed.
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1'
export const USE_MOCK_API = import.meta.env.VITE_API_MOCK === 'true'

const CSRF_COOKIE = 'XSRF-TOKEN'
const CSRF_HEADER = 'X-XSRF-TOKEN'

/** A 401 from these paths means "not logged in", not "your session ended". */
const UNAUTHORIZED_EXEMPT = ['/users/me', '/auth/login', '/auth/register']

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

interface ErrorEnvelope {
  code?: string
  message?: string
  details?: ApiErrorDetail[]
  traceId?: string
}

interface TransportResponse {
  status: number
  body: unknown
}

const FALLBACK_MESSAGES: Record<number, string> = {
  0: "We couldn't reach the server. Check your connection and try again.",
  401: 'Please log in to continue.',
  403: "You don't have access to this.",
  404: "We couldn't find what you were looking for.",
  409: 'That conflicts with a change made elsewhere. Refresh and try again.',
  422: 'Some of the details need another look.',
  429: 'Too many attempts. Please wait a moment and try again.',
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: ApiErrorDetail[]
  readonly traceId: string | undefined

  constructor(status: number, envelope: ErrorEnvelope | null) {
    super(envelope?.message || FALLBACK_MESSAGES[status] || 'Something went wrong. Please try again.')
    this.name = 'ApiError'
    this.status = status
    this.code = envelope?.code ?? (status === 0 ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR')
    this.details = Array.isArray(envelope?.details) ? envelope.details : []
    this.traceId = envelope?.traceId
  }
}

export function isApiError(error: unknown, status?: number): error is ApiError {
  return error instanceof ApiError && (status === undefined || error.status === status)
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Please try again.'
}

/** First server-side validation message for a field, if any. */
export function fieldError(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiError)) return undefined
  return error.details.find((d) => d.field === field)?.message
}

let unauthorizedHandler: (() => void) | null = null

/** Registers the callback run when an authenticated request comes back 401. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`
  for (const part of document.cookie.split('; ')) {
    if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length))
  }
  return null
}

async function fetchTransport(method: HttpMethod, path: string, body: unknown): Promise<TransportResponse> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') {
    const token = readCookie(CSRF_COOKIE)
    if (token) headers[CSRF_HEADER] = token
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    return { status: 0, body: null }
  }

  if (response.status === 204) return { status: 204, body: null }
  let parsed: unknown = null
  try {
    parsed = await response.json()
  } catch {
    // Non-JSON bodies (proxy error pages, empty responses) fall back to status-based messages.
  }
  return { status: response.status, body: parsed }
}

async function mockTransport(method: HttpMethod, path: string, body: unknown): Promise<TransportResponse> {
  const { handleMock } = await import('./mock/server')
  return handleMock(method, path, body)
}

export async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const response = USE_MOCK_API
    ? await mockTransport(method, path, body)
    : await fetchTransport(method, path, body)

  if (response.status === 401 && !UNAUTHORIZED_EXEMPT.some((p) => path.startsWith(p))) {
    unauthorizedHandler?.()
  }
  if (response.status === 0 || response.status >= 400) {
    const envelope =
      response.body !== null && typeof response.body === 'object' ? (response.body as ErrorEnvelope) : null
    throw new ApiError(response.status, envelope)
  }
  return response.body as T
}
