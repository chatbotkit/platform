/**
 * @jest-environment node
 */
import { withBilling, withSubscription } from '@/lib/billing.handler'

// @note the deployment gate needs a selling deployment to open - the test
// environment carries no SUBSCRIPTIONS_CONFIG, so sellability is pinned here.
// The entitlement gate needs a plan catalogue and a controllable
// subscription check, pinned the same way.
jest.mock('@/lib/billing.core', () => ({
  ...jest.requireActual('@/lib/billing.core'),

  __esModule: true,

  isSellable: true,

  isBillingConfigured: jest.fn(),

  hasSubscription: jest.fn(),
}))

jest.mock('@/config/limits', () => ({
  ...jest.requireActual('@/config/limits'),

  hasPlans: true,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: jest.fn((fn) => fn),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  ...jest.requireActual('@/lib/response'),

  noSubscription: jest.fn(() => ({ status: 403, body: 'No subscription' })),
}))

/**
 * A minimal Node pages-api request/response pair - the 404 path goes through
 * the withAny adapter, which writes to a real response object.
 */
function makeReqRes(url = 'http://localhost/api/billing/test') {
  const req = {
    method: 'GET',
    url,
    query: {},
    headers: { host: 'localhost' },
    on() {},
    removeListener() {},
  }

  const res = {
    statusCode: 0,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = value
    },
    getHeader(name) {
      return this.headers[name]
    },
    status(code) {
      this.statusCode = code

      return this
    },
    write(chunk) {
      this.body = (this.body || '') + chunk
    },
    end(chunk) {
      if (chunk) {
        this.write(chunk)
      }

      this.finished = true
    },
    on() {},
    once() {},
    removeListener() {},
    send(body) {
      this.body = body
      this.finished = true
    },
    json(body) {
      this.body = JSON.stringify(body)
      this.finished = true
    },
  }

  return { req, res }
}

describe('withBilling', () => {
  const { isBillingConfigured } = jest.requireMock('@/lib/billing.core')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('404s without ever calling the handler when billing is not configured', async () => {
    isBillingConfigured.mockReturnValue(false)

    const fn = jest.fn()

    const { req, res } = makeReqRes()

    await withBilling(fn)(req, res)

    expect(fn).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(404)
  })

  it('passes straight through when billing is configured', () => {
    isBillingConfigured.mockReturnValue(true)

    const fn = jest.fn((a, b) => `${a}${b}`)

    expect(withBilling(fn)('a', 'b')).toBe('ab')
    expect(fn).toHaveBeenCalledWith('a', 'b')
  })
})

describe('withSubscription', () => {
  let mockReq
  let mockSession
  let mockUserRow
  let mockFn
  let hasSubscription
  let noSubscription

  beforeEach(() => {
    jest.clearAllMocks()

    mockReq = { method: 'GET', url: '/test' }
    mockSession = {
      user: { id: 'user-123', email: 'test@example.com' },
    }

    // @note the gate reads the account row rather than the session - the
    // session carries no billing columns
    mockUserRow = {
      id: 'user-123',
      email: 'test@example.com',
      billingSubscriptionId: null,
      parentId: null,
    }

    mockFn = jest.fn(async () => ({ status: 200, body: 'success' }))

    const billing = jest.requireMock('@/lib/billing.core')
    const responseModule = jest.requireMock('@/lib/response')
    const userGet = jest.requireMock('@/lib/user.get')

    hasSubscription = billing.hasSubscription
    noSubscription = responseModule.noSubscription

    userGet.fastGetUserById.mockResolvedValue(mockUserRow)
  })

  describe('withSubscription', () => {
    it('should call function when user has any subscription', async () => {
      hasSubscription.mockReturnValue(true)

      const handler = withSubscription(mockFn)
      const result = await handler(mockReq, mockSession)

      expect(hasSubscription).toHaveBeenCalledWith(mockUserRow)
      expect(mockFn).toHaveBeenCalledWith(mockReq, mockSession)
      expect(result).toEqual({ status: 200, body: 'success' })
    })

    it('should return no subscription response when user does not have any subscription', async () => {
      hasSubscription.mockReturnValue(false)

      const handler = withSubscription(mockFn)

      await handler(mockReq, mockSession)

      expect(hasSubscription).toHaveBeenCalledWith(mockUserRow)
      expect(mockFn).not.toHaveBeenCalled()
      expect(noSubscription).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle function that throws error', async () => {
      hasSubscription.mockReturnValue(true)
      mockFn.mockRejectedValue(new Error('Test error'))

      const handler = withSubscription(mockFn)

      await expect(handler(mockReq, mockSession)).rejects.toThrow('Test error')
    })

    it('should handle session without user', async () => {
      const sessionWithoutUser = { user: null }

      const handler = withSubscription(mockFn)

      await handler(mockReq, sessionWithoutUser)

      expect(hasSubscription).not.toHaveBeenCalled()
      expect(mockFn).not.toHaveBeenCalled()
    })

    it('should handle undefined session user', async () => {
      const sessionUndefinedUser = {}

      const handler = withSubscription(mockFn)

      await handler(mockReq, sessionUndefinedUser)

      expect(hasSubscription).not.toHaveBeenCalled()
      expect(mockFn).not.toHaveBeenCalled()
    })

    it('should pass through function return value unchanged', async () => {
      hasSubscription.mockReturnValue(true)

      const customResponse = {
        status: 201,
        body: { id: '123', message: 'Created' },
        headers: { 'Content-Type': 'application/json' },
      }

      mockFn.mockResolvedValue(customResponse)

      const handler = withSubscription(mockFn)
      const result = await handler(mockReq, mockSession)

      expect(result).toEqual(customResponse)
    })
  })

  describe('handler composition', () => {
    it('should work with different request types', async () => {
      hasSubscription.mockReturnValue(true)

      const postReq = { method: 'POST', url: '/test', body: { data: 'test' } }
      const handler = withSubscription(mockFn)

      await handler(postReq, mockSession)

      expect(mockFn).toHaveBeenCalledWith(postReq, mockSession)
    })

    it('should work with different session structures', async () => {
      hasSubscription.mockReturnValue(true)

      const extendedSession = {
        user: {
          id: 'user-456',
          email: 'test@example.com',
          subscription: 'basic',
          metadata: { key: 'value' },
        },
        expires: '2025-12-31',
      }

      const handler = withSubscription(mockFn)

      await handler(mockReq, extendedSession)

      expect(hasSubscription).toHaveBeenCalledWith(mockUserRow)
      expect(mockFn).toHaveBeenCalledWith(mockReq, extendedSession)
    })
  })

  describe('subscription check consistency', () => {
    it('should check subscription before executing function', async () => {
      hasSubscription.mockReturnValue(false)

      const handler = withSubscription(mockFn)

      await handler(mockReq, mockSession)

      expect(hasSubscription).toHaveBeenCalled()
      expect(mockFn).not.toHaveBeenCalled()
    })

    it('should only call subscription check once', async () => {
      hasSubscription.mockReturnValue(true)

      const handler = withSubscription(mockFn)

      await handler(mockReq, mockSession)

      expect(hasSubscription).toHaveBeenCalledTimes(1)
    })

    it('should not call noSubscription when subscription exists', async () => {
      hasSubscription.mockReturnValue(true)

      const handler = withSubscription(mockFn)

      await handler(mockReq, mockSession)

      expect(noSubscription).not.toHaveBeenCalled()
    })
  })
})
