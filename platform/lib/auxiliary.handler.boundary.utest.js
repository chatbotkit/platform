/**
 * @jest-environment node
 */
import { authenticatedHandler, authenticatedMultiHandler } from './auxiliary.handler'

import z from 'zod'

// @note the trust boundary for auxiliary ability routes: every route is wrapped
// in the authenticated handlers, which delegate to the real withSession. These
// tests keep withSession real and only stub the session lookup so that an
// anonymous request (no cookie, no bearer token) is rejected before the route
// body runs, while an authenticated one reaches the body with its session.

jest.mock('@/lib/stream', () => ({
  withStream: jest.fn((fn) => {
    return async (request, ...args) => {
      const stream = {
        result: jest.fn(async (data) => {
          stream._result = data
        }),
        error: jest.fn(async (error) => {
          stream._error = error
        }),
        _result: undefined,
        _error: undefined,
      }

      await fn(request, stream, ...args)

      return stream
    }
  }),
}))

jest.mock('@/lib/method', () => ({
  withAny: jest.fn((fn) => fn),
}))

jest.mock('@/lib/response', () => ({
  ...jest.requireActual('@/lib/response'),
  captureUnknownException: jest.fn(),
}))

jest.mock('@/lib/session.get', () => ({
  getSession: jest.fn(async (req) => {
    const { throwNotAuthenticated } = jest.requireActual('@/lib/response')

    if (req.headers.get('authorization') !== 'Bearer valid-token') {
      return throwNotAuthenticated()
    }

    return { user: { id: 'user-1' } }
  }),
}))

function makeRequest(headers = {}, body = {}) {
  return {
    method: 'POST',
    headers: new Headers({ 'content-type': 'application/json', ...headers }),
    json: async () => body,
  }
}

const schema = z.object({ value: z.string() })

describe('auxiliary trust boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('authenticatedHandler', () => {
    it('rejects an anonymous POST with 401 before invoking the route body', async () => {
      const fn = jest.fn(async () => ({ ok: true }))

      const route = authenticatedHandler(schema, fn)

      const response = await route(makeRequest({}, { value: 'x' }))

      expect(response).toBeInstanceOf(Response)
      expect(response.status).toBe(401)
      expect(fn).not.toHaveBeenCalled()
    })

    it('rejects a POST carrying an invalid bearer token', async () => {
      const fn = jest.fn(async () => ({ ok: true }))

      const route = authenticatedHandler(schema, fn)

      const response = await route(
        makeRequest({ authorization: 'Bearer bogus' }, { value: 'x' })
      )

      expect(response.status).toBe(401)
      expect(fn).not.toHaveBeenCalled()
    })

    it('invokes the route body with the session for an authenticated POST', async () => {
      const fn = jest.fn(async (session, parameters) => ({
        userId: session.user.id,
        parameters,
      }))

      const route = authenticatedHandler(schema, fn)

      const stream = await route(
        makeRequest({ authorization: 'Bearer valid-token' }, { value: 'x' })
      )

      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn.mock.calls[0][0]).toEqual({ user: { id: 'user-1' } })
      expect(stream._result).toEqual({
        userId: 'user-1',
        parameters: { value: 'x' },
      })
    })
  })

  describe('authenticatedMultiHandler', () => {
    it('rejects an anonymous POST with 401 before resolving the handler name', async () => {
      const fn = jest.fn(async () => ({ ok: true }))

      const route = authenticatedMultiHandler({ one: { schema, fn } })

      const response = await route(
        makeRequest({ 'x-chatbotkit-handler-name': 'one' }, { value: 'x' })
      )

      expect(response.status).toBe(401)
      expect(fn).not.toHaveBeenCalled()
    })

    it('invokes the named handler with the session for an authenticated POST', async () => {
      const fn = jest.fn(async (session) => ({ userId: session.user.id }))

      const route = authenticatedMultiHandler({ one: { schema, fn } })

      const stream = await route(
        makeRequest(
          {
            authorization: 'Bearer valid-token',
            'x-chatbotkit-handler-name': 'one',
          },
          { value: 'x' }
        )
      )

      expect(fn).toHaveBeenCalledTimes(1)
      expect(stream._result).toEqual({ userId: 'user-1' })
    })
  })
})
