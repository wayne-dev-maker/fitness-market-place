import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, request, setUnauthorizedHandler } from './http'

// These tests exercise the real fetch transport (VITE_API_MOCK is unset under test).

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('request', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  })

  afterEach(() => {
    fetchMock.mockReset()
    setUnauthorizedHandler(null)
    vi.unstubAllGlobals()
  })

  it('sends cookies and returns the parsed body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'pln_1' }))

    await expect(request('GET', '/plans/pln_1')).resolves.toEqual({ id: 'pln_1' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/plans/pln_1')
    expect(init?.credentials).toBe('include')
  })

  it('echoes the CSRF cookie as a header on state-changing requests only', async () => {
    document.cookie = 'XSRF-TOKEN=token%2F123; path=/'
    fetchMock.mockImplementation(async () => jsonResponse(200, {}))

    await request('GET', '/plans')
    await request('POST', '/checkout', { planId: 'pln_1' })

    const getHeaders = fetchMock.mock.calls[0][1]?.headers as Record<string, string>
    const postHeaders = fetchMock.mock.calls[1][1]?.headers as Record<string, string>
    expect(getHeaders['X-XSRF-TOKEN']).toBeUndefined()
    expect(postHeaders['X-XSRF-TOKEN']).toBe('token/123')
    expect(postHeaders['Content-Type']).toBe('application/json')
  })

  it('turns the error envelope into an ApiError with field details', async () => {
    fetchMock.mockResolvedValue(jsonResponse(422, {
      code: 'VALIDATION_ERROR',
      message: 'Some of the details need another look.',
      details: [{ field: 'email', message: 'Enter a valid email address.' }],
      traceId: 'abc123',
    }))

    const error = await request('POST', '/auth/register', {}).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      traceId: 'abc123',
      details: [{ field: 'email', message: 'Enter a valid email address.' }],
    })
  })

  it('falls back to a readable message when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }))

    const error = (await request('GET', '/plans').catch((e: unknown) => e)) as ApiError

    expect(error.status).toBe(502)
    expect(error.message).toBe('Something went wrong. Please try again.')
  })

  it('reports a network failure as status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = (await request('GET', '/plans').catch((e: unknown) => e)) as ApiError

    expect(error.status).toBe(0)
    expect(error.code).toBe('NETWORK_ERROR')
  })

  it('returns null for 204 responses', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(request('POST', '/auth/logout')).resolves.toBeNull()
  })

  it('signals an ended session on 401, except for the login and identity checks', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    fetchMock.mockImplementation(async () => jsonResponse(401, { code: 'UNAUTHENTICATED', message: 'Please log in.' }))

    await request('GET', '/users/me').catch(() => {})
    await request('POST', '/auth/login', {}).catch(() => {})
    expect(onUnauthorized).not.toHaveBeenCalled()

    await request('GET', '/enrolments/me').catch(() => {})
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })
})
