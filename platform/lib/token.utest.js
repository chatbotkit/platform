/* eslint-disable @typescript-eslint/no-require-imports */
import {
  API_AUDIENCE,
  APP_AUDIENCE,
  NONE_AUDIENCE,
  USER_AUDIENCE,
} from '@/lib/audience.consts'
import { throwNotAuthorized } from '@/lib/response'
import {
  Glob,
  getPayloadVerifier,
  isJwtToken,
  isOAuthAccessToken,
  isOAuthRefreshToken,
  isSecretKey,
  validateReq,
} from '@/lib/token'

jest.mock('@/lib/response', () => ({
  throwNotAuthorized: jest.fn(),
}))

describe('isSecretKey', () => {
  it('must validate secret key', () => {
    expect(isSecretKey('sk-123')).toBe(true)
    expect(isSecretKey('something-else')).toBe(false)
  })
})

describe('isJwtToken', () => {
  it('must validate jwt token', () => {
    expect(isJwtToken('a.b.c')).toBe(true)
    expect(isJwtToken('a.b')).toBe(false)
  })
})

describe('Glob', () => {
  test('should match single pattern', () => {
    const glob = new Glob('/api/v1/bot/**')

    expect(glob.test('/api/v1/bot/list')).toBe(true)
    expect(glob.test('/api/v1/bot/create')).toBe(true)
    expect(glob.test('/api/v1/dataset/list')).toBe(false)
  })

  test('should match array of patterns', () => {
    const glob = new Glob(['/api/v1/bot/**', '/api/v1/dataset/**'])

    expect(glob.test('/api/v1/bot/list')).toBe(true)
    expect(glob.test('/api/v1/dataset/create')).toBe(true)
    expect(glob.test('/api/v1/conversation/send')).toBe(false)
  })

  test('should handle negation patterns', () => {
    const glob = new Glob(['/api/v1/**', '!/api/v1/admin/**'])

    expect(glob.test('/api/v1/bot/list')).toBe(true)
    expect(glob.test('/api/v1/admin/users')).toBe(false)
  })

  test('should handle exact path matches', () => {
    const glob = new Glob('/api/v1/bot/list')

    expect(glob.test('/api/v1/bot/list')).toBe(true)
    expect(glob.test('/api/v1/bot/create')).toBe(false)
  })

  test('should handle prefixes with patterns', () => {
    const glob = new Glob(['bot/**', 'dataset/**'], ['/api/v1/', '/v1/'])

    // Should match with /api/v1/ prefix
    expect(glob.test('/api/v1/bot/list')).toBe(true)
    expect(glob.test('/api/v1/dataset/create')).toBe(true)

    // Should match with /v1/ prefix
    expect(glob.test('/v1/bot/list')).toBe(true)
    expect(glob.test('/v1/dataset/create')).toBe(true)

    // Should not match without prefix
    expect(glob.test('/bot/list')).toBe(false)
  })

  test('should handle prefixes with already prefixed patterns', () => {
    const glob = new Glob(['/api/v1/bot/**'], ['/api/v1/'])

    // Should not double-prefix
    expect(glob.test('/api/v1/bot/list')).toBe(true)
    expect(glob.test('/api/v1/api/v1/bot/list')).toBe(false)
  })

  test('should handle prefixes with negation patterns', () => {
    const glob = new Glob(['**', '!admin/**'], ['/api/v1/'])

    expect(glob.test('/api/v1/bot/list')).toBe(true)
    expect(glob.test('/api/v1/admin/users')).toBe(false)
  })

  test('should handle empty pattern array', () => {
    const glob = new Glob([])

    expect(glob.test('/api/v1/bot/list')).toBe(false)
  })

  test('should match bot/**/usage/fetch pattern with prefixes', () => {
    const glob = new Glob(['bot/**/usage/fetch'], ['/api/v1/', '/v1/'])

    // Should match with any botId
    expect(glob.test('/api/v1/bot/123/usage/fetch')).toBe(true)
    expect(glob.test('/api/v1/bot/abc-def-456/usage/fetch')).toBe(true)
    expect(glob.test('/v1/bot/xyz/usage/fetch')).toBe(true)

    // Should NOT match other routes
    expect(glob.test('/api/v1/bot/123/usage/list')).toBe(false)
    expect(glob.test('/api/v1/bot/123/conversation/send')).toBe(false)
    expect(glob.test('/api/v1/dataset/123/usage/fetch')).toBe(false)

    // Should NOT match without prefix
    expect(glob.test('/bot/123/usage/fetch')).toBe(false)
  })
})

describe('validateReq', () => {
  const req = { url: '/api/v1/test' }

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('should allow request if route is included in allowedRoutes', () => {
    const allowedRoutes = ['/api/v1/test']

    validateReq(req, allowedRoutes)

    expect(throwNotAuthorized).not.toHaveBeenCalled()
  })

  test('should allow request if route matches a regex in allowedRoutes', () => {
    const allowedRoutes = [/^\/api\/v1\/test$/]

    validateReq(req, allowedRoutes)

    expect(throwNotAuthorized).not.toHaveBeenCalled()
  })

  test('should throw not authorized if route is not included in allowedRoutes', () => {
    const allowedRoutes = ['/api/v1/other']

    validateReq(req, allowedRoutes)

    expect(throwNotAuthorized).toHaveBeenCalled()
  })

  test('should throw not authorized if route does not match any regex in allowedRoutes', () => {
    const allowedRoutes = [/^\/api\/v1\/other$/]

    validateReq(req, allowedRoutes)

    expect(throwNotAuthorized).toHaveBeenCalled()
  })

  test('should allow request if route matches a glob in allowedRoutes', () => {
    const allowedRoutes = [new Glob('/api/v1/**')]

    validateReq(req, allowedRoutes)

    expect(throwNotAuthorized).not.toHaveBeenCalled()
  })

  test('should throw not authorized if route does not match glob in allowedRoutes', () => {
    const allowedRoutes = [new Glob('/api/v2/**')]

    validateReq(req, allowedRoutes)

    expect(throwNotAuthorized).toHaveBeenCalled()
  })

  test('should abort request if route is not included in allowedRoutes', () => {
    throwNotAuthorized.mockImplementationOnce((message) => {
      throw new Error(message)
    })

    expect(() => validateReq(req, ['/api/v1/other'])).toThrow(
      'Request is not matching allowed routes'
    )
  })

  test('should handle full URLs correctly', () => {
    const fullUrlReq = { url: 'http://example.com/api/v1/test' }

    const allowedRoutes = ['/api/v1/test']

    validateReq(fullUrlReq, allowedRoutes)

    expect(throwNotAuthorized).not.toHaveBeenCalled()
  })
})

describe('APP_AUDIENCE host selection', () => {
  const {
    runInContext,
    setContextFrontendHost,
    setContextRequestHost,
  } = require('@/lib/context.store')

  afterEach(() => {
    jest.clearAllMocks()
  })

  const verify = (frontendHost, requestHost) =>
    runInContext(async () => {
      if (frontendHost) {
        setContextFrontendHost(frontendHost)
      }

      if (requestHost) {
        setContextRequestHost(requestHost)
      }

      const verifier = await getPayloadVerifier({ aud: APP_AUDIENCE })

      await verifier({ url: 'http://internal/' })
    })()

  it('accepts an app session behind the portal gateway', async () => {
    // @note the asserted frontend host is the customer's domain; the request
    // host retains the portal hostname - the allowlist must key off the host
    // the routing tables recognise, not the public identity

    await verify('quench.qsbx.ai', 'quench-qsbx-ai.chatbotkit.agency')

    expect(throwNotAuthorized).not.toHaveBeenCalled()
  })

  it('accepts an app session on the portal host directly', async () => {
    await verify(null, 'quench-qsbx-ai.chatbotkit.agency')

    expect(throwNotAuthorized).not.toHaveBeenCalled()
  })

  it('rejects an app session when no host is an app hostname', async () => {
    await verify('quench.qsbx.ai', 'example.com')

    expect(throwNotAuthorized).toHaveBeenCalled()
  })

  it('accepts an app session when the frontend host is an app hostname', async () => {
    await verify('quench-qsbx-ai.chatbotkit.agency', 'example.com')

    expect(throwNotAuthorized).not.toHaveBeenCalled()
  })

  it('rejects an app session with no host context at all', async () => {
    await verify(null, null)

    expect(throwNotAuthorized).toHaveBeenCalled()
  })
})

describe('getPayloadVerifier', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it.each([
    [{ url: 'http://example.com' }, { aud: NONE_AUDIENCE }, true],
    [{ url: 'http://example.com/' }, { aud: NONE_AUDIENCE }, true],
    [{ url: 'http://example.com/test' }, { aud: NONE_AUDIENCE }, true],
    [{ url: 'http://example.com/v1/test' }, { aud: NONE_AUDIENCE }, true],
    [{ url: 'http://example.com/api/v1/test' }, { aud: NONE_AUDIENCE }, true],
    [{ url: 'http://example.com/api/v1/test' }, { aud: USER_AUDIENCE }, false],
    [{ url: 'http://example.com/test' }, { aud: USER_AUDIENCE }, false],
    [{ url: 'http://example.com/api/v1/test' }, { aud: API_AUDIENCE }, false],
    [{ url: 'http://example.com/v1/test' }, { aud: API_AUDIENCE }, false],
    [{ url: 'http://example.com/test' }, { aud: API_AUDIENCE }, true],
    [{ url: 'http://example.com/test' }, { aud: APP_AUDIENCE }, true],
    [{ url: 'http://example.com/v1/test' }, { aud: APP_AUDIENCE }, true],
    [{ url: 'http://example.com/api/v1/test' }, { aud: APP_AUDIENCE }, true],
  ])('must validate with payload verifier', async (req, payload, throws) => {
    const verifier = await getPayloadVerifier(payload)

    await verifier(req)

    if (throws) {
      expect(throwNotAuthorized).toHaveBeenCalled()
    } else {
      expect(throwNotAuthorized).not.toHaveBeenCalled()
    }
  })

  it('must reject disallowed routes when the authorization helper throws', async () => {
    throwNotAuthorized.mockImplementationOnce((message) => {
      throw new Error(message)
    })

    const verifier = await getPayloadVerifier({
      aud: USER_AUDIENCE,
      userId: 'user-123',
      allowedRoutes: ['/api/v1/bot/**'],
    })

    expect(() =>
      verifier({ url: 'http://example.com/api/v1/dataset/list' })
    ).toThrow('Request is not matching allowed routes')
  })

  describe('USER_AUDIENCE with path restrictions', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should allow request when path matches single glob pattern', async () => {
      const payload = {
        aud: USER_AUDIENCE,
        userId: 'user-123',
        allowedRoutes: ['/api/v1/bot/**'],
      }
      const req = { url: 'http://example.com/api/v1/bot/list' }

      const verifier = await getPayloadVerifier(payload)

      await verifier(req)

      expect(throwNotAuthorized).not.toHaveBeenCalled()
    })

    it('should deny request when path does not match glob pattern', async () => {
      const payload = {
        aud: USER_AUDIENCE,
        userId: 'user-123',
        allowedRoutes: ['/api/v1/bot/**'],
      }
      const req = { url: 'http://example.com/api/v1/dataset/list' }

      const verifier = await getPayloadVerifier(payload)

      await verifier(req)

      expect(throwNotAuthorized).toHaveBeenCalledWith(
        'Request is not matching allowed routes'
      )
    })

    it('should allow request when path matches one of multiple patterns', async () => {
      const payload = {
        aud: USER_AUDIENCE,
        userId: 'user-123',
        allowedRoutes: ['/api/v1/bot/**', '/api/v1/dataset/**'],
      }
      const req = { url: 'http://example.com/api/v1/dataset/create' }

      const verifier = await getPayloadVerifier(payload)

      await verifier(req)

      expect(throwNotAuthorized).not.toHaveBeenCalled()
    })

    it('should deny request when path matches negation pattern', async () => {
      const payload = {
        aud: USER_AUDIENCE,
        userId: 'user-123',
        allowedRoutes: ['/api/v1/**', '!/api/v1/admin/**'],
      }
      const req = { url: 'http://example.com/api/v1/admin/users' }

      const verifier = await getPayloadVerifier(payload)

      await verifier(req)

      expect(throwNotAuthorized).toHaveBeenCalledWith(
        'Request is not matching allowed routes'
      )
    })

    it('should allow request for non-admin path when admin is excluded', async () => {
      const payload = {
        aud: USER_AUDIENCE,
        userId: 'user-123',
        allowedRoutes: ['/api/v1/**', '!/api/v1/admin/**'],
      }
      const req = { url: 'http://example.com/api/v1/bot/list' }

      const verifier = await getPayloadVerifier(payload)

      await verifier(req)

      expect(throwNotAuthorized).not.toHaveBeenCalled()
    })

    it('should handle path-only URLs correctly', async () => {
      const payload = {
        aud: USER_AUDIENCE,
        userId: 'user-123',
        allowedRoutes: ['/api/v1/bot/**'],
      }
      const req = { url: '/api/v1/bot/list' }

      const verifier = await getPayloadVerifier(payload)

      await verifier(req)

      expect(throwNotAuthorized).not.toHaveBeenCalled()
    })

    it('should allow all routes when allowedRoutes is not specified', async () => {
      const payload = {
        aud: USER_AUDIENCE,
        userId: 'user-123',
        // no allowedRoutes
      }
      const req = { url: 'http://example.com/api/v1/admin/users' }

      const verifier = await getPayloadVerifier(payload)

      await verifier(req)

      expect(throwNotAuthorized).not.toHaveBeenCalled()
    })

    it('should handle exact path matches', async () => {
      const payload = {
        aud: USER_AUDIENCE,
        userId: 'user-123',
        allowedRoutes: ['/api/v1/bot/list'],
      }
      const req = { url: 'http://example.com/api/v1/bot/list' }

      const verifier = await getPayloadVerifier(payload)

      await verifier(req)

      expect(throwNotAuthorized).not.toHaveBeenCalled()
    })

    it('should deny exact path when trailing path segments differ', async () => {
      const payload = {
        aud: USER_AUDIENCE,
        userId: 'user-123',
        allowedRoutes: ['/api/v1/bot/list'],
      }
      const req = { url: 'http://example.com/api/v1/bot/create' }

      const verifier = await getPayloadVerifier(payload)

      await verifier(req)

      expect(throwNotAuthorized).toHaveBeenCalledWith(
        'Request is not matching allowed routes'
      )
    })

    it('should handle wildcard patterns correctly', async () => {
      const payload = {
        aud: USER_AUDIENCE,
        userId: 'user-123',
        allowedRoutes: ['/api/*/bot/**'],
      }
      const req = { url: 'http://example.com/api/v1/bot/list' }

      const verifier = await getPayloadVerifier(payload)

      await verifier(req)

      expect(throwNotAuthorized).not.toHaveBeenCalled()
    })

    it('should handle root path patterns', async () => {
      const payload = {
        aud: USER_AUDIENCE,
        userId: 'user-123',
        allowedRoutes: ['/**'],
      }
      const req = { url: 'http://example.com/any/path/works' }

      const verifier = await getPayloadVerifier(payload)

      await verifier(req)

      expect(throwNotAuthorized).not.toHaveBeenCalled()
    })

    it('should handle multiple patterns with mixed specificity', async () => {
      const payload = {
        aud: USER_AUDIENCE,
        userId: 'user-123',
        allowedRoutes: [
          '/api/v1/bot/list',
          '/api/v1/dataset/**',
          '/api/v1/conversation/*/send',
        ],
      }
      const req = { url: 'http://example.com/api/v1/conversation/123/send' }

      const verifier = await getPayloadVerifier(payload)

      await verifier(req)

      expect(throwNotAuthorized).not.toHaveBeenCalled()
    })

    it('should block all routes with empty allowedRoutes array', async () => {
      const payload = {
        aud: USER_AUDIENCE,
        userId: 'user-123',
        allowedRoutes: [],
      }
      const req = { url: 'http://example.com/api/v1/bot/list' }

      const verifier = await getPayloadVerifier(payload)

      await verifier(req)

      // Empty array means no patterns = block all routes
      expect(throwNotAuthorized).toHaveBeenCalledWith(
        'Request is not matching allowed routes'
      )
    })

    it('should block all routes with non-array allowedRoutes', async () => {
      const payload = {
        aud: USER_AUDIENCE,
        userId: 'user-123',
        allowedRoutes: '/api/v1/bot/**', // string instead of array
      }
      const req = { url: 'http://example.com/api/v1/bot/list' }

      const verifier = await getPayloadVerifier(payload)

      await verifier(req)

      // Non-array is invalid format = block all routes
      expect(throwNotAuthorized).toHaveBeenCalledWith(
        'Request is not matching allowed routes'
      )
    })

    it('should handle patterns without leading slash', () => {
      const payload = {
        aud: USER_AUDIENCE,
        userId: 'user-123',
        allowedRoutes: ['api/v1/bot/**'], // no leading /
      }
      const req = { url: 'http://example.com/api/v1/bot/list' }

      return getPayloadVerifier(payload).then((verifier) => {
        verifier(req)
        expect(throwNotAuthorized).not.toHaveBeenCalled()
      })
    })
  })

  describe('API_AUDIENCE with path restrictions', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should allow API request with no path restrictions', async () => {
      const payload = {
        aud: API_AUDIENCE,
        userId: 'user-123',
      }
      const req = { url: 'http://example.com/api/v1/bot/list' }

      const verifier = await getPayloadVerifier(payload)

      await verifier(req)

      expect(throwNotAuthorized).not.toHaveBeenCalled()
    })

    it('should allow API request with allowedRoutes', async () => {
      const payload = {
        aud: API_AUDIENCE,
        userId: 'user-123',
        allowedRoutes: ['bot/**', 'dataset/**'],
      }
      const req = { url: 'http://example.com/api/v1/bot/list' }

      const verifier = await getPayloadVerifier(payload)

      await verifier(req)

      expect(throwNotAuthorized).not.toHaveBeenCalled()
    })

    it('should deny API request when path does not match allowedRoutes', async () => {
      const payload = {
        aud: API_AUDIENCE,
        userId: 'user-123',
        allowedRoutes: ['bot/**'],
      }
      const req = { url: 'http://example.com/api/v1/dataset/list' }

      const verifier = await getPayloadVerifier(payload)

      await verifier(req)

      expect(throwNotAuthorized).toHaveBeenCalledWith(
        'Request is not matching allowed routes'
      )
    })

    it('should allow v1 prefix for API requests', async () => {
      const payload = {
        aud: API_AUDIENCE,
        userId: 'user-123',
        allowedRoutes: ['bot/**'],
      }
      const req = { url: 'http://example.com/v1/bot/list' }

      const verifier = await getPayloadVerifier(payload)

      await verifier(req)

      expect(throwNotAuthorized).not.toHaveBeenCalled()
    })

    it('should auto-prefix patterns with /api/v1/ and /v1/', async () => {
      const payload = {
        aud: API_AUDIENCE,
        userId: 'user-123',
        allowedRoutes: ['bot/list'], // will be prefixed
      }

      const verifier = await getPayloadVerifier(payload)

      // Should match /api/v1/bot/list
      await verifier({ url: 'http://example.com/api/v1/bot/list' })
      expect(throwNotAuthorized).not.toHaveBeenCalled()

      jest.clearAllMocks()

      // Should match /v1/bot/list
      await verifier({ url: 'http://example.com/v1/bot/list' })
      expect(throwNotAuthorized).not.toHaveBeenCalled()
    })

    it('should handle negation patterns for API', async () => {
      const payload = {
        aud: API_AUDIENCE,
        userId: 'user-123',
        allowedRoutes: ['**', '!admin/**'],
      }

      const verifier = await getPayloadVerifier(payload)

      // Should allow non-admin
      await verifier({ url: 'http://example.com/api/v1/bot/list' })
      expect(throwNotAuthorized).not.toHaveBeenCalled()

      jest.clearAllMocks()

      // Should deny admin
      await verifier({ url: 'http://example.com/api/v1/admin/users' })
      expect(throwNotAuthorized).toHaveBeenCalledWith(
        'Request is not matching allowed routes'
      )
    })

    it('should block all routes with empty array for API', async () => {
      const payload = {
        aud: API_AUDIENCE,
        userId: 'user-123',
        allowedRoutes: [],
      }
      const req = { url: 'http://example.com/api/v1/bot/list' }

      const verifier = await getPayloadVerifier(payload)

      await verifier(req)

      // Empty array means no patterns = block all routes
      expect(throwNotAuthorized).toHaveBeenCalledWith(
        'Request is not matching allowed routes'
      )
    })

    it('should block all routes with non-array allowedRoutes for API', async () => {
      const payload = {
        aud: API_AUDIENCE,
        userId: 'user-123',
        allowedRoutes: 'bot/**', // string instead of array
      }
      const req = { url: 'http://example.com/api/v1/bot/list' }

      const verifier = await getPayloadVerifier(payload)

      await verifier(req)

      // Non-array is invalid format = block all routes
      expect(throwNotAuthorized).toHaveBeenCalledWith(
        'Request is not matching allowed routes'
      )
    })
  })

  describe('Edge cases and error scenarios', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should handle unknown audience by throwing error', async () => {
      const payload = {
        aud: 'UNKNOWN_AUDIENCE',
        userId: 'user-123',
      }
      const req = { url: 'http://example.com/api/v1/bot/list' }

      const verifier = await getPayloadVerifier(payload)

      await verifier(req)

      expect(throwNotAuthorized).toHaveBeenCalledWith(
        'Default token audience used'
      )
    })

    it('should test isOAuthRefreshToken utility', () => {
      expect(isOAuthRefreshToken('oart-abc123')).toBe(true)
      expect(isOAuthRefreshToken('oaac-abc123')).toBe(false)
      expect(isOAuthRefreshToken('sk-abc123')).toBe(false)
    })

    it('should test isOAuthAccessToken utility', () => {
      expect(isOAuthAccessToken('oaac-abc123')).toBe(true)
      expect(isOAuthAccessToken('oart-abc123')).toBe(false)
      expect(isOAuthAccessToken('sk-abc123')).toBe(false)
    })

    it('should handle malformed JWT tokens gracefully', async () => {
      const malformedToken =
        'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature'

      // Import the actual function we're testing
      const { getJwtTokenVerifier } = require('@/lib/token')

      // Should not throw, but should return null/undefined or throw NotAuthorized
      const result = await getJwtTokenVerifier(malformedToken)

      // We expect this to be null for invalid tokens
      expect(result).toBeNull()
    })

    it('should handle completely invalid JWT format', async () => {
      const invalidToken = 'not.a.valid.jwt.at.all'

      const { getJwtTokenVerifier } = require('@/lib/token')

      // Should not throw cryptic errors
      const result = await getJwtTokenVerifier(invalidToken)

      expect(result).toBeNull()
    })
  })
})
